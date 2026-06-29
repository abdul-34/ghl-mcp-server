import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              CRM MCP
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/dashboard/subaccounts" className="text-slate-600 hover:text-slate-900">
                Sub-accounts
              </Link>
              <Link href="/dashboard/links" className="text-slate-600 hover:text-slate-900">
                MCP Links
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user.email}</span>
            <form action={signOut}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
