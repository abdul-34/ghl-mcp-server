import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AddSubaccountForm } from '@/components/AddSubaccountForm';
import { deleteSubaccount } from './actions';

export const dynamic = 'force-dynamic';

export default async function SubaccountsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: subaccounts } = await supabase
    .from('subaccounts')
    .select('id, name, location_id, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sub-accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          One row per CRM sub-account, each with its own Private Integration Token.
        </p>
      </div>

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
                  <div className="font-medium">{s.name || '(unnamed)'}</div>
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
