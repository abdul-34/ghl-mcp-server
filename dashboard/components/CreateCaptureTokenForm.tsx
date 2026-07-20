'use client';

import { useActionState, useState } from 'react';
import { createCaptureToken, type CreateCaptureTokenResult } from '@/app/dashboard/capture/actions';

const initial: CreateCaptureTokenResult = { ok: false };

export function CreateCaptureTokenForm() {
  const [state, formAction, pending] = useActionState(createCaptureToken, initial);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, which: string) {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">Generate a capture token</h2>
      <p className="mt-1 text-sm text-slate-500">
        Paste this into the CRM Token Bridge extension. It lets the extension push the Firebase
        credentials of whichever sub-account you capture from into that sub-account&apos;s row.
      </p>

      {state.ok && state.secret ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Token created. Copy it now — it is shown only once.
          </p>
          <div>
            <span className="text-xs font-medium text-emerald-800">MCP server URL</span>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs">
                {state.serverUrl}
              </code>
              <button
                onClick={() => copy(state.serverUrl!, 'url')}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {copied === 'url' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-emerald-800">Capture token</span>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs">
                {state.secret}
              </code>
              <button
                onClick={() => copy(state.secret!, 'token')}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {copied === 'token' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.error ? <p className="mt-3 text-sm text-red-600">{state.error}</p> : null}

      <form action={formAction} className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">Label (optional)</label>
          <input
            name="label"
            placeholder="My workstation"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Generating…' : 'Generate'}
        </button>
      </form>
    </div>
  );
}
