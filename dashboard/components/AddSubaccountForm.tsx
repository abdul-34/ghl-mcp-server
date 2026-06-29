'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addSubaccount, type ActionResult } from '@/app/dashboard/subaccounts/actions';

const initial: ActionResult = { ok: false };

export function AddSubaccountForm() {
  const [state, formAction, pending] = useActionState(addSubaccount, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="font-medium">Add a sub-account</h2>
      <p className="mt-1 text-sm text-slate-500">
        The token is encrypted before it&apos;s stored. It is never shown again after saving.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Name (optional)</label>
          <input
            name="name"
            placeholder="Acme Co."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Location ID</label>
          <input
            name="location_id"
            required
            placeholder="e.g. ve9EPM428h8vShlRW1KT"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700">Private Integration Token</label>
        <input
          name="pit_token"
          type="password"
          required
          placeholder="pit-..."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-3 text-sm text-emerald-600">Sub-account saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save sub-account'}
      </button>
    </form>
  );
}
