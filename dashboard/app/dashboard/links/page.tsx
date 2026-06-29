import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateLinkForm } from '@/components/CreateLinkForm';
import { revokeLink, deleteLink } from './actions';

export const dynamic = 'force-dynamic';

export default async function LinksPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: subaccounts }, { data: links }] = await Promise.all([
    supabase.from('subaccounts').select('id, name, location_id').order('created_at'),
    supabase
      .from('mcp_links')
      .select('id, label, scope, subaccount_id, enabled_tools, revoked, created_at, last_used_at')
      .order('created_at', { ascending: false }),
  ]);

  const subById = new Map((subaccounts || []).map((s) => [s.id, s]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">MCP Links</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each link is a unique URL you give to a client or AI tool. The token is hashed before
          storage and shown only once at creation.
        </p>
      </div>

      <CreateLinkForm subaccounts={subaccounts || []} />

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-medium">Existing links</h2>
        </div>
        {links && links.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {links.map((l) => {
              const sub = l.subaccount_id ? subById.get(l.subaccount_id) : null;
              const toolCount = (l.enabled_tools as string[] | null)?.length ?? 0;
              return (
                <li key={l.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.label || '(untitled link)'}</span>
                      {l.revoked && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          revoked
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {l.scope === 'agency'
                        ? 'All sub-accounts'
                        : `Location: ${sub ? sub.name || sub.location_id : l.subaccount_id}`}
                      {' · '}
                      {toolCount === 0 ? 'all tools' : `${toolCount} tools`}
                      {l.last_used_at ? ` · last used ${new Date(l.last_used_at).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!l.revoked && (
                      <form action={revokeLink}>
                        <input type="hidden" name="id" value={l.id} />
                        <button className="text-sm text-amber-600 hover:underline">Revoke</button>
                      </form>
                    )}
                    <form action={deleteLink}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-sm text-red-600 hover:underline">Delete</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-500">No links yet.</p>
        )}
      </div>
    </div>
  );
}
