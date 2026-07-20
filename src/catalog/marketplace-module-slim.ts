/**
 * Slim live marketplace module search responses for MCP clients.
 *
 * The /marketplace/core/search/module endpoint returns apps with full action
 * and trigger definitions, including large runtime code / generator blobs.
 * Those blow past Claude tool-result limits. Search returns compact hits;
 * get-by-key returns one module schema with runtime blobs stripped.
 */

export interface MarketplaceModuleHit {
  appName: string;
  appId?: string;
  moduleKey: string;
  kind: 'action' | 'trigger';
  name: string;
  description: string;
  section?: string;
  version?: string;
  requiredFields: string[];
  inputFields: string[];
  filterFields: string[];
  customVarRefs: string[];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fieldName(input: Record<string, unknown>): string {
  return asString(input.field || input.name || input.title);
}

function collectFieldNames(inputs: unknown): string[] {
  if (!Array.isArray(inputs)) return [];
  return inputs
    .map(item => {
      const rec = asRecord(item);
      return rec ? fieldName(rec) : '';
    })
    .filter(Boolean);
}

function collectRequiredFields(inputs: unknown): string[] {
  if (!Array.isArray(inputs)) return [];
  return inputs
    .map(item => {
      const rec = asRecord(item);
      if (!rec || !rec.required) return '';
      return fieldName(rec);
    })
    .filter(Boolean);
}

function collectCustomVarRefs(mod: Record<string, unknown>): string[] {
  if (!Array.isArray(mod.customVars)) return [];
  return mod.customVars
    .map(item => {
      const rec = asRecord(item);
      return rec ? asString(rec.reference || rec.name) : '';
    })
    .filter(Boolean);
}

function moduleDisplayName(mod: Record<string, unknown>): string {
  const info = asRecord(mod.info);
  return (
    asString(info?.displayName) ||
    asString(info?.title) ||
    asString(info?.name) ||
    asString(mod.name) ||
    asString(mod.key) ||
    'Unknown'
  );
}

function moduleDescription(mod: Record<string, unknown>): string {
  const info = asRecord(mod.info);
  return asString(info?.description) || asString(info?.helpText) || asString(mod.description);
}

function appNameOf(app: Record<string, unknown>): string {
  return (
    asString(app.appName) ||
    asString(app.name) ||
    asString(app.title) ||
    asString(asRecord(app.info)?.name) ||
    'Unknown App'
  );
}

function appIdOf(app: Record<string, unknown>): string | undefined {
  const id = asString(app.appId || app._id || app.id);
  return id || undefined;
}

/** Extract module arrays from an app payload (actions or triggers). */
export function extractMarketplaceModules(
  app: unknown,
  kind: 'action' | 'trigger'
): Array<Record<string, unknown>> {
  const rec = asRecord(app);
  if (!rec) return [];

  const primaryKey = kind === 'action' ? 'actions' : 'triggers';
  const altKey = kind === 'action' ? 'triggers' : 'actions';
  const modules = rec[primaryKey] ?? rec.modules ?? rec[altKey];

  if (Array.isArray(modules)) {
    return modules.map(asRecord).filter((item): item is Record<string, unknown> => !!item);
  }

  // Some payloads are already a single module object with a key.
  if (asString(rec.key)) return [rec];
  return [];
}

export function toMarketplaceModuleHit(
  app: Record<string, unknown>,
  mod: Record<string, unknown>,
  kind: 'action' | 'trigger'
): MarketplaceModuleHit | null {
  const moduleKey = asString(mod.key);
  if (!moduleKey) return null;

  return {
    appName: appNameOf(app),
    appId: appIdOf(app),
    moduleKey,
    kind,
    name: moduleDisplayName(mod),
    description: moduleDescription(mod),
    section: asString(mod.section) || asString(app.section) || undefined,
    version: asString(mod.version) || undefined,
    requiredFields: collectRequiredFields(mod.inputs || mod.filters),
    inputFields: collectFieldNames(mod.inputs),
    filterFields: collectFieldNames(mod.filters),
    customVarRefs: collectCustomVarRefs(mod),
  };
}

export function slimMarketplaceSearchResults(
  apps: unknown[],
  kind: 'action' | 'trigger',
  options?: { maxModules?: number }
): {
  appCount: number;
  moduleCount: number;
  results: MarketplaceModuleHit[];
} {
  const maxModules = Math.min(Math.max(options?.maxModules ?? 25, 1), 100);
  const results: MarketplaceModuleHit[] = [];

  for (const appRaw of apps) {
    const app = asRecord(appRaw);
    if (!app) continue;
    for (const mod of extractMarketplaceModules(app, kind)) {
      const hit = toMarketplaceModuleHit(app, mod, kind);
      if (!hit) continue;
      results.push(hit);
      if (results.length >= maxModules) {
        return { appCount: apps.length, moduleCount: results.length, results };
      }
    }
  }

  return { appCount: apps.length, moduleCount: results.length, results };
}

function stripGeneratorFields(inputs: unknown): unknown {
  if (!Array.isArray(inputs)) return inputs;
  return inputs.map(item => {
    const rec = asRecord(item);
    if (!rec) return item;
    const next = { ...rec };
    const dfc = asRecord(next.dynamicFieldsConfig);
    if (dfc) {
      const config = { ...dfc };
      if ('customGenerator' in config) config.customGenerator = '';
      if ('customInputConfigGenerator' in config) config.customInputConfigGenerator = '';
      if ('customFieldGenerator' in config) config.customFieldGenerator = '';
      next.dynamicFieldsConfig = config;
    }
    // Drop nested execution/code blobs sometimes embedded on inputs
    if (typeof next.code === 'string') next.code = '';
    return next;
  });
}

/** Full module schema for Claude, without runtime JS blobs. */
export function slimMarketplaceModuleForResponse(
  mod: Record<string, unknown>,
  app?: Record<string, unknown>
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...mod };

  if (app) {
    clone._app = {
      appName: appNameOf(app),
      appId: appIdOf(app),
    };
  }

  const exec = asRecord(clone.executionConfig);
  if (exec) {
    const nextExec = { ...exec };
    if (typeof nextExec.code === 'string') nextExec.code = '';
    clone.executionConfig = nextExec;
  }

  if (clone.inputs) clone.inputs = stripGeneratorFields(clone.inputs);
  if (clone.filters) clone.filters = stripGeneratorFields(clone.filters);

  // Common large generator fields on the module itself
  for (const key of [
    'customInputConfigGenerator',
    'customFieldGenerator',
    'customGenerator',
    'code',
  ]) {
    if (typeof clone[key] === 'string') clone[key] = '';
  }

  const customInput = asRecord(clone.customInputFieldConfig);
  if (customInput) {
    const next = { ...customInput };
    for (const key of ['customInputConfigGenerator', 'customFieldGenerator', 'code']) {
      if (typeof next[key] === 'string') next[key] = '';
    }
    const dyn = asRecord(next.customFieldDynamicSource);
    if (dyn && typeof dyn.code === 'string') {
      next.customFieldDynamicSource = { ...dyn, code: '' };
    }
    clone.customInputFieldConfig = next;
  }

  return clone;
}

export function findMarketplaceModuleByKey(
  apps: unknown[],
  key: string,
  kind: 'action' | 'trigger'
): {
  found: boolean;
  module?: Record<string, unknown>;
  matches?: MarketplaceModuleHit[];
} {
  const want = key.trim().toLowerCase();
  const matches: MarketplaceModuleHit[] = [];
  let exact: { app: Record<string, unknown>; mod: Record<string, unknown> } | null = null;

  for (const appRaw of apps) {
    const app = asRecord(appRaw);
    if (!app) continue;
    for (const mod of extractMarketplaceModules(app, kind)) {
      const hit = toMarketplaceModuleHit(app, mod, kind);
      if (!hit) continue;
      const modKey = hit.moduleKey.toLowerCase();
      if (modKey === want) {
        exact = { app, mod };
        matches.unshift(hit);
      } else if (modKey.includes(want) || hit.name.toLowerCase().includes(want)) {
        matches.push(hit);
      }
    }
  }

  if (exact) {
    return {
      found: true,
      module: slimMarketplaceModuleForResponse(exact.mod, exact.app),
      matches: matches.slice(0, 8),
    };
  }

  return {
    found: false,
    matches: matches.slice(0, 8),
  };
}
