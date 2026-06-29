import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const supabase = await createSupabaseServerClient();

  const [{ count: subCount }, { count: linkCount }] = await Promise.all([
    supabase.from('subaccounts').select('id', { count: 'exact', head: true }),
    supabase.from('mcp_links').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your CRM sub-account tokens, then generate per-client MCP URLs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/subaccounts"
          className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand hover:shadow-sm"
        >
          <div className="text-3xl font-semibold">{subCount ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">Sub-accounts connected</div>
        </Link>
        <Link
          href="/dashboard/links"
          className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand hover:shadow-sm"
        >
          <div className="text-3xl font-semibold">{linkCount ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">MCP links generated</div>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-medium">Getting started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>
            In each CRM sub-account, create a <strong>Private Integration Token</strong> with the
            scopes you need.
          </li>
          <li>
            Add the sub-account here under{' '}
            <Link href="/dashboard/subaccounts" className="text-brand hover:underline">
              Sub-accounts
            </Link>{' '}
            (location ID + token).
          </li>
          <li>
            Generate an{' '}
            <Link href="/dashboard/links" className="text-brand hover:underline">
              MCP Link
            </Link>{' '}
            scoped to one sub-account (or your whole agency), pick the tools, and share the URL.
          </li>
        </ol>
      </div>
    </div>
  );
}
