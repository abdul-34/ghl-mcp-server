import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AddSubaccountForm } from '@/components/AddSubaccountForm';
import { OauthInstallPanel } from '@/components/OauthInstallPanel';
import { deleteSubaccount } from './actions';
import { getInstallStatus } from './oauth-actions';

export const dynamic = 'force-dynamic';

export default async function SubaccountsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: subaccounts }, installStatus, { data: agencyCreds }] = await Promise.all([
    supabase
      .from('subaccounts')
      .select('id, name, location_id, created_at, base_refresh_token, workflow_creds_updated_at, auth_mode')
      .order('created_at', { ascending: false }),
    getInstallStatus(),
    // Firebase is captured once at the agency level and shared by every sub-account,
    // so this counts as "workflow ready" for all rows even without a per-row token.
    supabase.from('agency_builder_tokens').select('firebase_refresh_encrypted').maybeSingle(),
  ]);
  const agencyHasFirebase = Boolean(agencyCreds?.firebase_refresh_encrypted);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sub-accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          One row per CRM sub-account. Connect via the GoHighLevel Marketplace app (auto-refreshing
          tokens) or add one manually with its Private Integration Token.
        </p>
      </div>

      <OauthInstallPanel status={installStatus} />

      <AddSubaccountForm />

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-medium">Connected sub-accounts</h2>
        </div>
        {subaccounts && subaccounts.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {subaccounts.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name || '(unnamed)'}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        s.auth_mode === 'oauth'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.auth_mode === 'oauth' ? 'OAuth' : 'PIT'}
                    </span>
                    {s.base_refresh_token || agencyHasFirebase ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        workflow ready
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        no workflow creds
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-slate-500">{s.location_id}</div>
                </div>
                <form action={deleteSubaccount}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-sm text-red-600 hover:underline">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-500">No sub-accounts yet.</p>
        )}
      </div>
    </div>
  );
}
