'use client';

import { useActionState, useState } from 'react';
import { createLink, type CreateLinkResult } from '@/app/dashboard/links/actions';
import { TOOL_CATALOG } from '@/lib/tools-catalog';

const initial: CreateLinkResult = { ok: false };

type Subaccount = { id: string; name: string | null; location_id: string };

export function CreateLinkForm({ subaccounts }: { subaccounts: Subaccount[] }) {
  const [state, formAction, pending] = useActionState(createLink, initial);
  const [scope, setScope] = useState<'location' | 'agency'>('location');
  const [allTools, setAllTools] = useState(true);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.url) return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">Generate a new MCP link</h2>

      {state.ok && state.url ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Link created. Copy it now — the token is shown only once.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs">
              {state.url}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="mt-4 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Label (optional)</label>
          <input
            name="label"
            placeholder="Acme Co. — production"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700">Scope</span>
          <div className="mt-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="scope"
                value="location"
                checked={scope === 'location'}
                onChange={() => setScope('location')}
              />
              Single sub-account (for a client)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="scope"
                value="agency"
                checked={scope === 'agency'}
                onChange={() => setScope('agency')}
              />
              All my sub-accounts (agency)
            </label>
          </div>
        </div>

        {scope === 'location' && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Sub-account</label>
            <select
              name="subaccount_id"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Select a sub-account…</option>
              {subaccounts.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.name || '(unnamed)') + ' — ' + s.location_id}
                </option>
              ))}
            </select>
            {subaccounts.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Add a sub-account first before creating a location-scoped link.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={allTools}
              onChange={(e) => setAllTools(e.target.checked)}
            />
            Expose all tools
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Uncheck to restrict this link to a specific set of tools.
          </p>
        </div>

        {!allTools && (
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-slate-200 p-4">
            {TOOL_CATALOG.map((group) => (
              <fieldset key={group.category}>
                <legend className="text-sm font-medium text-slate-800">{group.category}</legend>
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {group.tools.map((tool) => (
                    <label key={tool} className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" name="tools" value={tool} />
                      <span className="font-mono">{tool}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Generating…' : 'Generate link'}
        </button>
      </form>
    </div>
  );
}
