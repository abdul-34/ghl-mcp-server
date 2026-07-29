'use client';

import { useState, useTransition } from 'react';
import {
  listInstallableLocations,
  addOauthSubaccount,
  type InstallStatus,
} from '@/app/dashboard/subaccounts/oauth-actions';
import type { InstalledLocation } from '@/lib/ghl-oauth';

/**
 * Premium OAuth path: connect the GHL Marketplace app once at the agency, then
 * add sub-accounts where the app is installed — no PIT to paste. Their tokens are
 * minted + refreshed server-side, so the MCP URL never expires.
 */
export function OauthInstallPanel({ status }: { status: InstallStatus }) {
  const [locations, setLocations] = useState<InstalledLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  function load() {
    setError(null);
    startLoad(async () => {
      const res = await listInstallableLocations();
      if (!res.ok) setError(res.error ?? 'Failed to load installed sub-accounts.');
      else setLocations(res.locations ?? []);
    });
  }

  function add(loc: InstalledLocation) {
    setError(null);
    startSave(async () => {
      const fd = new FormData();
      fd.set('location_id', loc.locationId);
      if (loc.name) fd.set('name', loc.name);
      const res = await addOauthSubaccount({ ok: false }, fd);
      if (!res.ok) setError(res.error ?? 'Failed to add sub-account.');
      else setAdded((prev) => new Set(prev).add(loc.locationId));
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Connect with GoHighLevel (recommended)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Install our Marketplace app once on your agency. Sub-accounts you add here authenticate
            with auto-refreshing tokens — no Private Integration Token to paste or rotate.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            status.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {status.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {!status.connected ? (
        <a
          href="/api/oauth/crm/install"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          Connect GoHighLevel
        </a>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load installed sub-accounts'}
            </button>
            <a href="/api/oauth/crm/install" className="text-sm text-slate-500 hover:text-slate-800">
              Reconnect
            </a>
          </div>

          {locations && locations.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              No new installed sub-accounts found. Install the app on a sub-account in GoHighLevel, then reload.
            </p>
          )}

          {locations && locations.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {locations.map((loc) => (
                <li key={loc.locationId} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{loc.name || loc.locationId}</p>
                    <p className="truncate font-mono text-xs text-slate-400">{loc.locationId}</p>
                  </div>
                  {added.has(loc.locationId) ? (
                    <span className="shrink-0 text-sm text-emerald-600">Added ✓</span>
                  ) : (
                    <button
                      onClick={() => add(loc)}
                      disabled={saving}
                      className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
