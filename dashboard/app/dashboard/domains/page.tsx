import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DomainForm } from '@/components/DomainForm';
import { verifyDomain, deleteDomain } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  verifying: 'bg-amber-100 text-amber-700',
  pending: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-700',
};

type CfRecord = { type: string; name: string; value: string };

export default async function DomainsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: domains } = await supabase
    .from('custom_domains')
    .select('id, domain, status, verified, cf_verification, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">White-label domains</h1>
        <p className="mt-1 text-sm text-slate-500">
          Map your own domain so client MCP URLs live on your brand. TLS is issued automatically by
          Cloudflare — set the DNS records shown, then click Verify. New links use your active domain.
        </p>
      </div>

      <DomainForm />

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-medium">Your domains</h2>
        </div>
        {domains && domains.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {domains.map((d) => {
              const records = (Array.isArray(d.cf_verification) ? d.cf_verification : []) as CfRecord[];
              return (
                <li key={d.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{d.domain}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[d.status as string] ?? STATUS_STYLE.pending}`}
                      >
                        {d.status as string}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <form action={verifyDomain}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          Verify
                        </button>
                      </form>
                      <form action={deleteDomain}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="text-sm text-red-600 hover:underline">Delete</button>
                      </form>
                    </div>
                  </div>

                  {d.status !== 'active' && records.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="mb-2 font-medium text-slate-700">Set these DNS records, then click Verify:</p>
                      <table className="w-full text-left">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="pr-4 font-normal">Type</th>
                            <th className="pr-4 font-normal">Name</th>
                            <th className="font-normal">Value</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {records.map((r, i) => (
                            <tr key={i}>
                              <td className="pr-4 align-top">{r.type}</td>
                              <td className="pr-4 align-top break-all">{r.name}</td>
                              <td className="break-all">{r.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-500">No domains yet.</p>
        )}
      </div>
    </div>
  );
}
