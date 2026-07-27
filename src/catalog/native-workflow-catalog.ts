/**
 * Static native CRM workflow action/trigger catalog.
 *
 * Backed by data/workflow-data-native.json (assets export). Used for local
 * schema discovery so the LLM can pick native module keys and input fields
 * without calling the live marketplace search (which only covers installed
 * apps).
 *
 * The JSON asset is bundled at build time (scripts/copy-assets.mjs copies
 * src/catalog/data/*.json → dist/catalog/data/), so __dirname resolution works
 * identically under ts-node (dev) and the compiled CommonJS output (prod).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NativeModuleKind = 'action' | 'trigger';

export interface NativeModuleInfo {
  name?: string;
  description?: string;
  displayName?: string;
  title?: string;
  icon?: string;
  keywords?: string[];
  helpText?: string;
  context?: string;
  color?: string;
}

export interface NativeModuleInput {
  field?: string;
  title?: string;
  name?: string;
  required?: boolean;
  fieldType?: string;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ label?: string; value?: string; disabled?: boolean }>;
  defaultOperator?: string;
  [key: string]: unknown;
}

export interface NativeWorkflowModule {
  _id?: string;
  key: string;
  kind: NativeModuleKind;
  section: string;
  version?: string;
  info?: NativeModuleInfo;
  inputs?: NativeModuleInput[];
  filters?: NativeModuleInput[];
  conditions?: Array<Record<string, unknown>>;
  customVars?: Array<Record<string, unknown>>;
  workflowsActionType?: string;
  workflowsTriggerType?: string;
  customVarPrefix?: string;
  executionConfig?: Record<string, unknown>;
  isDeleted?: boolean;
  isHidden?: boolean;
  /** Normalized flag: this module is marked hidden in the CRM builder. */
  hidden?: boolean;
  [key: string]: unknown;
}

export interface NativeModuleSearchHit {
  key: string;
  kind: NativeModuleKind;
  name: string;
  description: string;
  section: string;
  version?: string;
  requiredFields: string[];
  inputFields: string[];
  filterFields: string[];
  customVarRefs: string[];
  hasExampleAttributes?: boolean;
  hasExampleTrigger?: boolean;
  hasExampleVariants?: boolean;
  /** Field names whose values are generated live by GHL (not in the static schema). */
  dynamicFields?: string[];
  /** True when the module is marked hidden in the CRM builder. */
  hidden?: boolean;
  allowedOperators?: string[];
  score: number;
}

interface CatalogFile {
  actions?: Array<{ name?: string; type?: string; actions?: Record<string, unknown>[] }>;
  triggers?: Array<{ name?: string; type?: string; triggers?: Record<string, unknown>[] }>;
  _meta?: Record<string, unknown>;
}

interface IndexedCatalog {
  path: string;
  modules: NativeWorkflowModule[];
  byKey: Map<string, NativeWorkflowModule[]>;
}

let cached: IndexedCatalog | null = null;

export function resetNativeWorkflowCatalogCache(): void {
  cached = null;
}

export function resolveNativeCatalogPath(): string {
  const fromEnv = process.env.CRM_NATIVE_WORKFLOW_CATALOG_PATH?.trim();
  const candidates = [
    fromEnv,
    // Bundled next to the compiled module (dist/catalog/data or src/catalog/data).
    join(__dirname, 'data', 'workflow-data-native.json'),
    join(process.cwd(), 'src', 'catalog', 'data', 'workflow-data-native.json'),
    join(process.cwd(), 'dist', 'catalog', 'data', 'workflow-data-native.json'),
    join(process.cwd(), 'workflow-data-native.json'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    'Native workflow catalog not found. Expected src/catalog/data/workflow-data-native.json ' +
      '(bundled to dist/catalog/data at build time) or set CRM_NATIVE_WORKFLOW_CATALOG_PATH.'
  );
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function moduleName(mod: NativeWorkflowModule): string {
  return (
    mod.info?.displayName ||
    mod.info?.title ||
    mod.info?.name ||
    mod.key
  );
}

function moduleDescription(mod: NativeWorkflowModule): string {
  return mod.info?.description || mod.info?.helpText || '';
}

function fieldName(input: NativeModuleInput): string {
  return asString(input.field || input.name || input.title);
}

function collectFieldNames(inputs: NativeModuleInput[] | undefined): string[] {
  if (!Array.isArray(inputs)) return [];
  return inputs.map(fieldName).filter(Boolean);
}

function collectRequiredFields(inputs: NativeModuleInput[] | undefined): string[] {
  if (!Array.isArray(inputs)) return [];
  return inputs.filter(input => input.required).map(fieldName).filter(Boolean);
}

function collectCustomVarRefs(mod: NativeWorkflowModule): string[] {
  if (!Array.isArray(mod.customVars)) return [];
  return mod.customVars
    .map(item => asString((item as { reference?: string }).reference || (item as { name?: string }).name))
    .filter(Boolean);
}

function normalizeModule(
  raw: Record<string, unknown>,
  kind: NativeModuleKind,
  groupName: string
): NativeWorkflowModule | null {
  const key = asString(raw.key);
  if (!key) return null;
  // Drop only truly-removed modules. Keep hidden ones (flagged) so they're still
  // discoverable — some useful native/third-party modules are marked hidden.
  if (raw.isDeleted === true) return null;

  return {
    ...raw,
    key,
    kind,
    hidden: raw.isHidden === true,
    section: asString(raw.section) || groupName || 'Other',
    info: (raw.info as NativeModuleInfo | undefined) || undefined,
    inputs: Array.isArray(raw.inputs) ? (raw.inputs as NativeModuleInput[]) : undefined,
    filters: Array.isArray(raw.filters) ? (raw.filters as NativeModuleInput[]) : undefined,
    conditions: Array.isArray(raw.conditions) ? (raw.conditions as Array<Record<string, unknown>>) : undefined,
    customVars: Array.isArray(raw.customVars) ? (raw.customVars as Array<Record<string, unknown>>) : undefined,
    version: asString(raw.version) || undefined,
  };
}

/**
 * Field names whose valid values are generated live by GHL (dynamic fields) — the
 * static schema lists the field but not its options. Detected via a
 * dynamicFieldsConfig on the input or a fieldType that signals a dynamic source.
 */
function collectDynamicFields(mod: NativeWorkflowModule): string[] {
  const scan = (inputs: NativeModuleInput[] | undefined): string[] => {
    if (!Array.isArray(inputs)) return [];
    return inputs
      .filter((input) => {
        const hasDynamicConfig = Boolean((input as { dynamicFieldsConfig?: unknown }).dynamicFieldsConfig);
        const ft = asString(input.fieldType).toLowerCase();
        return hasDynamicConfig || ft.includes('dynamic');
      })
      .map(fieldName)
      .filter(Boolean);
  };
  return [...new Set([...scan(mod.inputs), ...scan(mod.filters)])];
}

function loadCatalog(forceReload = false): IndexedCatalog {
  if (cached && !forceReload) return cached;

  const catalogPath = resolveNativeCatalogPath();
  const parsed = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogFile;
  const modules: NativeWorkflowModule[] = [];

  for (const group of parsed.actions || []) {
    const groupName = asString(group.name);
    for (const raw of group.actions || []) {
      const mod = normalizeModule(raw, 'action', groupName);
      if (mod) modules.push(mod);
    }
  }

  for (const group of parsed.triggers || []) {
    const groupName = asString(group.name);
    for (const raw of group.triggers || []) {
      const mod = normalizeModule(raw, 'trigger', groupName);
      if (mod) modules.push(mod);
    }
  }

  const byKey = new Map<string, NativeWorkflowModule[]>();
  for (const mod of modules) {
    const list = byKey.get(mod.key) || [];
    list.push(mod);
    byKey.set(mod.key, list);
  }

  cached = { path: catalogPath, modules, byKey };
  return cached;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map(token => token.trim())
    .filter(token => token.length >= 2);
}

// Third-party integration modules (marketplace apps) vs. core native GHL modules.
// Native modules should rank first for generic verbs like "add tag" / "send sms".
const INTEGRATION_PREFIX =
  /^(lc_|asana|notion|jira|slack|google|googlecontact|hubspot|monday|clickup|klaviyo|calendly|zoom|trello|airtable|typeform|basecamp|linear|vapi|apify|survey_monkey|surveymonkey|browse_ai|manus|housecall|shopify|mailchimp|activecampaign|pipedrive|salesforce|quickbooks|xero|stripe|twilio|sendgrid|whatsapp|telegram|discord|webhook_)/i;

export function isIntegrationKey(key: string): boolean {
  return INTEGRATION_PREFIX.test(key || '');
}

function isIntegrationModule(mod: NativeWorkflowModule): boolean {
  return isIntegrationKey(mod.key);
}

function scoreModule(mod: NativeWorkflowModule, query: string, tokens: string[]): number {
  const key = mod.key.toLowerCase();
  const name = moduleName(mod).toLowerCase();
  const description = moduleDescription(mod).toLowerCase();
  const section = mod.section.toLowerCase();
  const keywords = (mod.info?.keywords || []).map(k => k.toLowerCase()).join(' ');
  const haystack = `${key} ${name} ${description} ${section} ${keywords}`;
  const q = query.toLowerCase().trim();

  let score = 0;
  if (!q) return 1;
  if (key === q) score += 1000;
  if (name === q) score += 800;
  if (key.includes(q)) score += 400;
  if (name.includes(q)) score += 300;
  if (section.includes(q)) score += 180;
  if (description.includes(q)) score += 120;
  if (keywords.includes(q)) score += 140;

  for (const token of tokens) {
    if (key.includes(token)) score += 60;
    if (name.includes(token)) score += 45;
    if (section.includes(token)) score += 25;
    if (haystack.includes(token)) score += 10;
  }

  // Rank core native GHL modules above third-party integration modules for the
  // same verb (e.g. native "sms" over an app's "send message"). Only when the
  // module actually matched the query, so it never surfaces irrelevant natives.
  if (score > 1 && !isIntegrationModule(mod)) score += 250;

  // Keep hidden modules discoverable but ranked below visible equivalents.
  if (mod.hidden && score > 1) score = Math.max(1, score - 150);

  return score;
}

/**
 * Cheap exact-key lookup (no search fallback). Returns the module or undefined.
 * Used by the workflow validator to check that an action `type` is a real module.
 */
export function lookupNativeModule(key: string, kind?: NativeModuleKind): NativeWorkflowModule | undefined {
  const k = asString(key).trim();
  if (!k) return undefined;
  const list = loadCatalog().byKey.get(k) || [];
  const filtered = kind ? list.filter((m) => m.kind === kind) : list;
  return filtered[0];
}

function toSearchHit(mod: NativeWorkflowModule, score: number): NativeModuleSearchHit {
  const filters = Array.isArray(mod.filters) ? mod.filters : [];
  const allowedOperators = [
    ...new Set(
      filters.flatMap(filter => {
        const ops = (filter as { allowedOperators?: string[] }).allowedOperators;
        return Array.isArray(ops) ? ops : [];
      })
    ),
  ];

  return {
    key: mod.key,
    kind: mod.kind,
    name: moduleName(mod),
    description: moduleDescription(mod),
    section: mod.section,
    version: mod.version,
    requiredFields: collectRequiredFields(mod.inputs || mod.filters),
    inputFields: collectFieldNames(mod.inputs),
    filterFields: collectFieldNames(mod.filters),
    customVarRefs: collectCustomVarRefs(mod),
    hasExampleAttributes: Boolean((mod as { exampleAttributes?: unknown }).exampleAttributes),
    hasExampleTrigger: Boolean((mod as { exampleTrigger?: unknown }).exampleTrigger),
    hasExampleVariants: Boolean(
      (mod as { exampleAttributesVariants?: unknown }).exampleAttributesVariants ||
        (mod as { exampleNodes?: unknown }).exampleNodes ||
        (mod as { usageModes?: unknown }).usageModes
    ),
    dynamicFields: (() => {
      const df = collectDynamicFields(mod);
      return df.length ? df : undefined;
    })(),
    hidden: mod.hidden || undefined,
    allowedOperators: allowedOperators.length ? allowedOperators : undefined,
    score,
  };
}

/** Strip bulky empty runtime blobs before returning full schemas to the LLM. */
export function slimModuleForResponse(mod: NativeWorkflowModule): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...mod };

  if (clone.executionConfig && typeof clone.executionConfig === 'object') {
    const exec = { ...(clone.executionConfig as Record<string, unknown>) };
    if (typeof exec.code === 'string') exec.code = '';
    clone.executionConfig = exec;
  }

  const stripGenerators = (inputs: unknown): unknown => {
    if (!Array.isArray(inputs)) return inputs;
    return inputs.map(input => {
      if (!input || typeof input !== 'object') return input;
      const next = { ...(input as Record<string, unknown>) };
      const dfc = next.dynamicFieldsConfig;
      if (dfc && typeof dfc === 'object') {
        const config = { ...(dfc as Record<string, unknown>) };
        if ('customGenerator' in config) config.customGenerator = '';
        next.dynamicFieldsConfig = config;
      }
      return next;
    });
  };

  if (clone.inputs) clone.inputs = stripGenerators(clone.inputs);
  if (clone.filters) clone.filters = stripGenerators(clone.filters);

  return clone;
}

export function searchNativeWorkflowModules(options: {
  query?: string;
  type?: 'actions' | 'triggers' | 'both';
  section?: string;
  limit?: number;
}): {
  source: string;
  catalogPath: string;
  totalIndexed: number;
  resultCount: number;
  results: NativeModuleSearchHit[];
  note: string;
} {
  const catalog = loadCatalog();
  const type = options.type || 'both';
  const limit = Math.min(Math.max(options.limit ?? 15, 1), 50);
  const query = asString(options.query).trim();
  const tokens = tokenize(query);
  const sectionFilter = asString(options.section).trim().toLowerCase();

  const hits: NativeModuleSearchHit[] = [];
  for (const mod of catalog.modules) {
    if (type === 'actions' && mod.kind !== 'action') continue;
    if (type === 'triggers' && mod.kind !== 'trigger') continue;
    if (sectionFilter && !mod.section.toLowerCase().includes(sectionFilter)) continue;

    const score = scoreModule(mod, query, tokens);
    if (query && score <= 0) continue;
    hits.push(toSearchHit(mod, score || 1));
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    source: 'static-native-workflow-catalog',
    catalogPath: catalog.path,
    totalIndexed: catalog.modules.length,
    resultCount: Math.min(hits.length, limit),
    results: hits.slice(0, limit),
    note:
      'Use key as the workflow action/trigger type. Call crm_get_native_workflow_module with the key ' +
      'to load the full inputs/filters schema before creating or updating a workflow.',
  };
}

/**
 * When a module's static schema can't fully describe the payload (dynamic-value
 * fields, empty inputs, or a hidden module), tell the caller how to get a
 * ground-truth payload instead of guessing.
 */
function resolutionFor(mod: NativeWorkflowModule): {
  dynamicFields?: string[];
  hidden?: boolean;
  resolution?: string;
} {
  const dynamicFields = collectDynamicFields(mod);
  const hasStaticSchema =
    (Array.isArray(mod.inputs) && mod.inputs.length > 0) ||
    (Array.isArray(mod.filters) && mod.filters.length > 0);
  const needsExamples = dynamicFields.length > 0 || !hasStaticSchema;

  let resolution: string | undefined;
  if (needsExamples) {
    const reason = !hasStaticSchema
      ? 'This module has no static field schema'
      : `Fields ${dynamicFields.join(', ')} have values generated live by GHL`;
    resolution =
      `${reason}. For the exact payload, call crm_find_workflow_examples with key "${mod.key}" to pull a ` +
      `real ${mod.kind} from your own workflows` +
      (mod.key.startsWith('lc_')
        ? ', or crm_get_workflow_module if this is an installed marketplace app.'
        : '.');
  }

  return {
    dynamicFields: dynamicFields.length ? dynamicFields : undefined,
    hidden: mod.hidden || undefined,
    resolution,
  };
}

export function getNativeWorkflowModule(options: {
  key: string;
  type?: 'actions' | 'triggers' | 'both';
}): {
  source: string;
  catalogPath: string;
  found: boolean;
  module?: Record<string, unknown>;
  matches?: NativeModuleSearchHit[];
  dynamicFields?: string[];
  hidden?: boolean;
  resolution?: string;
  note: string;
} {
  const catalog = loadCatalog();
  const key = asString(options.key).trim();
  if (!key) {
    throw new Error('key is required');
  }

  const type = options.type || 'both';
  const exact = (catalog.byKey.get(key) || []).filter(mod => {
    if (type === 'actions') return mod.kind === 'action';
    if (type === 'triggers') return mod.kind === 'trigger';
    return true;
  });

  if (exact.length === 1) {
    return {
      source: 'static-native-workflow-catalog',
      catalogPath: catalog.path,
      found: true,
      module: slimModuleForResponse(exact[0]),
      ...resolutionFor(exact[0]),
      note: 'Populate workflow attributes/conditions from inputs or filters. Use exampleAttributes / exampleNode / exampleTrigger when present — those are the exact CRM payload shapes. If a resolution hint is present, prefer crm_find_workflow_examples for a real payload.',
    };
  }

  if (exact.length > 1) {
    return {
      source: 'static-native-workflow-catalog',
      catalogPath: catalog.path,
      found: true,
      matches: exact.map(mod => toSearchHit(mod, 1000)),
      module: slimModuleForResponse(exact[0]),
      ...resolutionFor(exact[0]),
      note: `Multiple modules share key "${key}"; returning the first. Prefer filtering by type.`,
    };
  }

  // Fallback: ranked search suggestions when exact key is missing
  const suggestions = searchNativeWorkflowModules({
    query: key,
    type,
    limit: 8,
  });

  return {
    source: 'static-native-workflow-catalog',
    catalogPath: catalog.path,
    found: false,
    matches: suggestions.results,
    note: `No exact module for key "${key}". Closest matches are in matches[]; pick one and call this tool again. If this is an installed app or a real payload is needed, try crm_find_workflow_examples or crm_search_workflow_modules.`,
  };
}

export function listNativeWorkflowSections(type: 'actions' | 'triggers' | 'both' = 'both'): {
  source: string;
  sections: Array<{ section: string; kind: NativeModuleKind; count: number }>;
} {
  const catalog = loadCatalog();
  const counts = new Map<string, { section: string; kind: NativeModuleKind; count: number }>();

  for (const mod of catalog.modules) {
    if (type === 'actions' && mod.kind !== 'action') continue;
    if (type === 'triggers' && mod.kind !== 'trigger') continue;
    const mapKey = `${mod.kind}:${mod.section}`;
    const existing = counts.get(mapKey);
    if (existing) existing.count += 1;
    else counts.set(mapKey, { section: mod.section, kind: mod.kind, count: 1 });
  }

  return {
    source: 'static-native-workflow-catalog',
    sections: [...counts.values()].sort((a, b) => a.section.localeCompare(b.section)),
  };
}
