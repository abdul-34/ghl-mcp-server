import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM MCP Dashboard',
  description: 'Manage CRM sub-account tokens and generate per-client MCP URLs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
