/**
 * Generate MCP tool modules from HighLevel's OpenAPI specs.
 *
 * Source specs: the public, CC0-licensed `GoHighLevel/api-v2-docs` repo, cloned
 * into `.ghl-api-docs/`. One tool is generated per operation (path + method).
 *
 *   git clone --depth 1 https://github.com/GoHighLevel/api-v2-docs .ghl-api-docs
 *   node scripts/generate-tools.mjs
 *
 * Output:
 *   src/tools/generated/<group>.ts        one module per API group
 *   src/tools/generated/index.ts          aggregated GENERATED_TOOLS + catalog
 *   dashboard/lib/tools-catalog.ts        grouped tool names for the UI picker
 *
 * Excluded per spec: OAuth 2.0 and Developer Marketplace.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, '.ghl-api-docs', 'apps');
const OUT = path.join(ROOT, 'src', 'tools', 'generated');
const DASH_CATALOG = path.join(ROOT, 'dashboard', 'lib', 'tools-catalog.ts');

const DEFAULT_VERSION = '2021-07-28';
const MAX_DEPTH = 4;
const MAX_NAME = 64;

// group key (also tool-name prefix + module name) → { file, category }
const GROUPS = [
  { key: 'ads',            file: 'ad-manager.json',            category: 'Ad Manager' },
  { key: 'affiliate',      file: 'affiliate-manager.json',     category: 'Affiliate Manager' },
  { key: 'ai_agent',       file: 'agent-studio.json',          category: 'AI Agent Studio' },
  { key: 'associations',   file: 'associations.json',          category: 'Associations' },
  { key: 'blogs',          file: 'blogs.json',                 category: 'Blogs' },
  { key: 'brand_boards',   file: 'brand-boards.json',          category: 'Brand Boards' },
  { key: 'business',       file: 'businesses.json',            category: 'Business' },
  { key: 'calendars',      file: 'calendars.json',             category: 'Calendars' },
  { key: 'campaigns',      file: 'campaigns.json',             category: 'Campaigns' },
  { key: 'chat_widget',    file: 'v3/chat-widget-v3.json',     category: 'Chat Widget' },
  { key: 'companies',      file: 'companies.json',             category: 'Companies' },
  { key: 'contacts',       file: 'contacts.json',              category: 'Contacts' },
  { key: 'conversation_ai',file: 'conversation-ai.json',       category: 'Conversation AI' },
  { key: 'conversations',  file: 'conversations.json',         category: 'Conversations' },
  { key: 'courses',        file: 'courses.json',               category: 'Courses' },
  { key: 'custom_fields',  file: 'custom-fields.json',         category: 'Custom Fields V2' },
  { key: 'custom_menus',   file: 'custom-menus.json',          category: 'Custom Menus' },
  { key: 'email_isv',      file: 'email-isv.json',             category: 'Email ISV' },
  { key: 'email',          file: 'emails.json',                category: 'Email' },
  { key: 'forms',          file: 'forms.json',                 category: 'Forms' },
  { key: 'funnels',        file: 'funnels.json',               category: 'Funnels' },
  { key: 'invoices',       file: 'invoices.json',              category: 'Invoice' },
  { key: 'knowledge_base', file: 'knowledge-base.json',        category: 'Knowledge Base' },
  { key: 'links',          file: 'links.json',                 category: 'Trigger Links' },
  { key: 'locations',      file: 'locations.json',             category: 'Sub-Account' },
  { key: 'media',          file: 'medias.json',                category: 'Media Storage' },
  { key: 'objects',        file: 'objects.json',               category: 'Objects' },
  { key: 'opportunities',  file: 'opportunities.json',         category: 'Opportunities' },
  { key: 'payments',       file: 'payments.json',              category: 'Payments' },
  { key: 'phone',          file: 'phone-system.json',          category: 'LC Phone' },
  { key: 'products',       file: 'products.json',              category: 'Products' },
  { key: 'proposals',      file: 'proposals.json',             category: 'Proposals' },
  { key: 'saas',           file: 'saas-api.json',              category: 'SaaS' },
  { key: 'snapshots',      file: 'snapshots.json',             category: 'Snapshots' },
  { key: 'social',         file: 'social-media-posting.json',  category: 'Social Planner' },
  { key: 'store',          file: 'store.json',                 category: 'Store' },
  { key: 'surveys',        file: 'surveys.json',               category: 'Surveys' },
];

const SKIP_HEADER_PARAMS = new Set(['version', 'authorization', 'accept', 'content-type']);

// ---------------------------------------------------------------------------
// spec loading + $ref resolution
// ---------------------------------------------------------------------------
const fileCache = new Map();

function loadSpec(file) {
  const abs = path.isAbsolute(file) ? file : path.join(DOCS, file);
  if (fileCache.has(abs)) return fileCache.get(abs);
  const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
  fileCache.set(abs, json);
  return json;
}

function pointerGet(obj, pointer) {
  const parts = pointer.replace(/^#?\//, '').split('/').filter(Boolean);
  let node = obj;
  for (const raw of parts) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node == null) return undefined;
    node = node[key];
  }
  return node;
}

/** Resolve a $ref to { spec, node }. Handles internal and cross-file refs. */
function resolveRef(ref, spec, specDir) {
  const [filePart, pointer] = ref.split('#');
  let targetSpec = spec;
  if (filePart) {
    // Relative to the referencing spec's directory.
    const abs = path.resolve(specDir, filePart);
    try {
      targetSpec = loadSpec(abs);
    } catch {
      try {
        targetSpec = loadSpec(path.join(DOCS, path.basename(filePart)));
      } catch {
        return { spec, node: undefined };
      }
    }
  }
  return { spec: targetSpec, node: pointerGet(targetSpec, pointer || '') };
}

// ---------------------------------------------------------------------------
// schema dereference (depth + cycle limited)
// ---------------------------------------------------------------------------
function deref(schema, spec, specDir, depth, seen) {
  if (!schema || typeof schema !== 'object') return {};

  if (schema.$ref) {
    if (seen.has(schema.$ref) || depth <= 0) return { type: 'object', additionalProperties: true };
    const nextSeen = new Set(seen);
    nextSeen.add(schema.$ref);
    const { spec: s2, node } = resolveRef(schema.$ref, spec, specDir);
    if (!node) return { type: 'object', additionalProperties: true };
    return deref(node, s2, specDir, depth - 1, nextSeen);
  }

  if (Array.isArray(schema.allOf)) {
    const merged = { type: 'object', properties: {}, required: [] };
    for (const part of schema.allOf) {
      const d = deref(part, spec, specDir, depth, seen);
      if (d.properties) Object.assign(merged.properties, d.properties);
      if (Array.isArray(d.required)) merged.required.push(...d.required);
      if (d.type && d.type !== 'object') merged.type = d.type;
    }
    if (schema.description) merged.description = clip(schema.description, 300);
    if (!merged.required.length) delete merged.required;
    if (!Object.keys(merged.properties).length) delete merged.properties;
    return merged;
  }

  const variant = schema.oneOf || schema.anyOf;
  if (Array.isArray(variant) && variant.length) {
    const d = deref(variant[0], spec, specDir, depth, seen);
    if (schema.description) d.description = clip(schema.description, 300);
    return d;
  }

  const out = {};
  const type = schema.type || (schema.properties ? 'object' : undefined);
  if (type) out.type = type;
  if (schema.description) out.description = clip(schema.description, 300);
  if (schema.enum) out.enum = schema.enum.slice(0, 50);
  if (schema.format) out.format = schema.format;

  if (type === 'object' || schema.properties) {
    if (depth <= 0) return { type: 'object', additionalProperties: true };
    out.type = 'object';
    if (schema.properties) {
      out.properties = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        out.properties[k] = deref(v, spec, specDir, depth - 1, seen);
      }
    }
    if (Array.isArray(schema.required)) out.required = schema.required.slice();
    out.additionalProperties = true;
  } else if (type === 'array') {
    out.items = depth > 0 ? deref(schema.items || {}, spec, specDir, depth - 1, seen) : {};
  }

  return out;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function clip(s, n) {
  if (typeof s !== 'string') return s;
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
}

function snake(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function makeName(group, operationId, method, p, used) {
  let base = operationId ? snake(operationId) : snake(`${method}_${p}`);
  let name = `${group}_${base}`;
  if (name.length > MAX_NAME) {
    const h = crypto.createHash('sha1').update(name).digest('hex').slice(0, 6);
    name = `${name.slice(0, MAX_NAME - 7)}_${h}`;
  }
  let final = name;
  let i = 2;
  while (used.has(final)) {
    const suffix = `_${i++}`;
    final = name.slice(0, MAX_NAME - suffix.length) + suffix;
  }
  used.add(final);
  return final;
}

const LOCATION_NAMES = new Set(['locationId', 'location_id', 'altId']);
const LOC_PROP = { type: 'string', description: 'CRM sub-account (location) ID to act on. Use list_accounts to discover it.' };

// ---------------------------------------------------------------------------
// build one tool spec from an operation
// ---------------------------------------------------------------------------
function buildOperation(group, spec, specDir, p, method, op, used) {
  const name = makeName(group, op.operationId, method, p, used);

  const properties = {};
  const required = [];
  const pathParams = [];
  const queryParams = [];
  let version;

  for (const param of op.parameters || []) {
    const where = param.in;
    if (where === 'header') {
      if (param.name === 'Version') {
        const enums = param.schema && param.schema.enum;
        version = (enums && enums[0]) || version;
      }
      continue;
    }
    if (where === 'cookie') continue;
    if (SKIP_HEADER_PARAMS.has(String(param.name).toLowerCase())) continue;

    const schema = param.schema ? deref(param.schema, spec, specDir, MAX_DEPTH, new Set()) : { type: 'string' };
    if (param.description) schema.description = clip(param.description, 300);
    properties[param.name] = schema;
    if (where === 'path') {
      pathParams.push(param.name);
      if (!required.includes(param.name)) required.push(param.name);
    } else if (where === 'query') {
      queryParams.push(param.name);
      if (param.required && !required.includes(param.name)) required.push(param.name);
    }
  }

  let bodyParams = [];
  let rawBody = false;
  const reqBody = op.requestBody;
  if (reqBody && reqBody.content) {
    const media = reqBody.content['application/json'] || Object.values(reqBody.content)[0];
    if (media && media.schema) {
      const bodySchema = deref(media.schema, spec, specDir, MAX_DEPTH, new Set());
      if (bodySchema.type === 'object' && bodySchema.properties) {
        for (const [k, v] of Object.entries(bodySchema.properties)) {
          if (properties[k]) continue; // path/query wins on collision
          properties[k] = v;
          bodyParams.push(k);
        }
        if (Array.isArray(bodySchema.required)) {
          for (const r of bodySchema.required) if (!required.includes(r)) required.push(r);
        }
      } else {
        rawBody = true;
        properties.body = bodySchema;
        if (reqBody.required) required.push('body');
      }
    }
  }

  // Always expose locationId for session routing (reuse the endpoint's own
  // location param if it already has one).
  const hasLoc = Object.keys(properties).some((k) => LOCATION_NAMES.has(k));
  if (!properties.locationId) properties.locationId = { ...LOC_PROP };
  if (!required.includes('locationId')) required.push('locationId');

  const inputSchema = {
    type: 'object',
    properties,
    required: Array.from(new Set(required)),
    additionalProperties: false,
  };

  const scope = op.security && op.security[0] && op.security[0].bearer && op.security[0].bearer[0];
  const summary = op.summary || op.operationId || name;
  const description = clip(scope ? `${summary} [scope: ${scope}]` : summary, 480);

  return {
    name,
    description,
    method: method.toUpperCase(),
    path: p,
    version: version && version !== DEFAULT_VERSION ? version : version || undefined,
    pathParams,
    queryParams,
    bodyParams,
    rawBody,
    inputSchema,
    _hasLoc: hasLoc,
  };
}

// ---------------------------------------------------------------------------
// emit a module
// ---------------------------------------------------------------------------
function emitModule(group, tools) {
  const lines = [];
  lines.push(`// AUTO-GENERATED from HighLevel OpenAPI specs. Do not edit by hand.`);
  lines.push(`// Regenerate with: node scripts/generate-tools.mjs`);
  lines.push(`import { apiTool } from './_runtime.js';`);
  lines.push(`import { ToolDef } from '../types.js';`);
  lines.push('');
  lines.push(`export const ${group}Tools: ToolDef[] = [`);
  for (const t of tools) {
    const spec = {
      name: t.name,
      description: t.description,
      method: t.method,
      path: t.path,
      ...(t.version ? { version: t.version } : {}),
      pathParams: t.pathParams,
      queryParams: t.queryParams,
      bodyParams: t.bodyParams,
      ...(t.rawBody ? { rawBody: true } : {}),
      inputSchema: t.inputSchema,
    };
    lines.push(`  apiTool(${JSON.stringify(spec)}),`);
  }
  lines.push(`];`);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(DOCS)) {
    console.error(`Specs not found at ${DOCS}. Clone them first:`);
    console.error('  git clone --depth 1 https://github.com/GoHighLevel/api-v2-docs .ghl-api-docs');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const used = new Set();
  const moduleNames = [];
  const catalog = [];
  let total = 0;

  for (const g of GROUPS) {
    const specPath = path.join(DOCS, g.file);
    if (!fs.existsSync(specPath)) {
      console.warn(`skip ${g.key}: ${g.file} not found`);
      continue;
    }
    const spec = loadSpec(specPath);
    const specDir = path.dirname(specPath);
    const tools = [];

    for (const [p, methods] of Object.entries(spec.paths || {})) {
      for (const [method, op] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        if (!op || typeof op !== 'object') continue;
        tools.push(buildOperation(g.key, spec, specDir, p, method, op, used));
      }
    }

    if (!tools.length) {
      console.warn(`skip ${g.key}: no operations`);
      continue;
    }

    fs.writeFileSync(path.join(OUT, `${g.key}.ts`), emitModule(g.key, tools), 'utf8');
    moduleNames.push(g.key);
    catalog.push({ category: g.category, tools: tools.map((t) => ({ name: t.name, description: t.description })) });
    total += tools.length;
    console.log(`${g.key.padEnd(16)} ${tools.length} tools`);
  }

  // index.ts
  const idx = [];
  idx.push(`// AUTO-GENERATED. Do not edit by hand. Run: node scripts/generate-tools.mjs`);
  idx.push(`import { ToolDef } from '../types.js';`);
  for (const m of moduleNames) idx.push(`import { ${m}Tools } from './${m}.js';`);
  idx.push('');
  idx.push(`export const GENERATED_TOOLS: ToolDef[] = [`);
  for (const m of moduleNames) idx.push(`  ...${m}Tools,`);
  idx.push(`];`);
  idx.push('');
  idx.push(`export interface GeneratedCatalogEntry { category: string; tools: { name: string; description: string }[]; }`);
  idx.push(`export const GENERATED_CATALOG: GeneratedCatalogEntry[] = ${JSON.stringify(catalog, null, 2)};`);
  idx.push('');
  fs.writeFileSync(path.join(OUT, 'index.ts'), idx.join('\n'), 'utf8');

  // dashboard catalog
  const dash = [];
  dash.push(`// AUTO-GENERATED. Do not edit by hand. Run: node scripts/generate-tools.mjs`);
  dash.push(`export interface ToolGroup { category: string; tools: string[]; }`);
  dash.push(`export const TOOL_CATALOG: ToolGroup[] = ${JSON.stringify(
    catalog.map((c) => ({ category: c.category, tools: c.tools.map((t) => t.name) })),
    null,
    2
  )};`);
  dash.push(`export const ALL_TOOL_NAMES: string[] = TOOL_CATALOG.flatMap((g) => g.tools);`);
  dash.push('');
  fs.writeFileSync(DASH_CATALOG, dash.join('\n'), 'utf8');

  console.log(`\nTotal: ${total} tools across ${moduleNames.length} groups.`);
}

main();
