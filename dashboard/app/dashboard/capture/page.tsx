import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateCaptureTokenForm } from '@/components/CreateCaptureTokenForm';
import { revokeCaptureToken, deleteCaptureToken } from './actions';

export const dynamic = 'force-dynamic';

export default async function CapturePage() {
  const supabase = await createSupabaseServerClient();

  const { data: tokens } = await supabase
    .from('workflow_capture_tokens')
    .select('id, label, revoked, created_at, last_used_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow capture</h1>
        <p className="mt-1 text-sm text-slate-500">
          The workflow-builder tools use GoHighLevel&apos;s internal API, which needs each
          sub-account&apos;s Firebase credentials. Install the CRM Token Bridge extension, paste a
          capture token below, then capture from each sub-account&apos;s CRM tab. Credentials are
          stored encrypted and refreshed automatically. Add the sub-account (with its PIT) first.
        </p>
      </div>

      <CreateCaptureTokenForm />

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-medium">Existing capture tokens</h2>
        </div>
        {tokens && tokens.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.label || '(untitled token)'}</span>
                    {t.revoked && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">revoked</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    created {new Date(t.created_at).toLocaleDateString()}
                    {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleString()}` : ' · never used'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!t.revoked && (
                    <form action={revokeCaptureToken}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-sm text-amber-600 hover:underline">Revoke</button>
                    </form>
                  )}
                  <form action={deleteCaptureToken}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-sm text-red-600 hover:underline">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-500">No capture tokens yet.</p>
        )}
      </div>
    </div>
  );
}
