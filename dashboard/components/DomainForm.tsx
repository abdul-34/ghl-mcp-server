'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addDomain, type ActionResult } from '@/app/dashboard/domains/actions';

const initial: ActionResult = { ok: false };

export function DomainForm() {
  const [state, formAction, pending] = useActionState(addDomain, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">Add a custom domain</h2>
      <p className="mt-1 text-sm text-slate-500">
        Serve your clients&apos; MCP URLs on your own white-label domain. After adding it, set the DNS records
        shown below and click Verify.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm font-medium text-slate-700">Domain</label>
          <input
            name="domain"
            required
            placeholder="mcp.your-agency.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add domain'}
        </button>
      </div>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
