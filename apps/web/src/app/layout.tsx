import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';

export const metadata: Metadata = {
  title: 'QuotaFlow — Production Usage Metering & Quota Service',
  description:
    'Atomic, PostgreSQL-backed usage metering and quota enforcement service for account and user level limits.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4">
            QuotaFlow Usage Metering & Quota Service • Built with Express.js, TypeScript, Next.js, and PostgreSQL
          </div>
        </footer>
      </body>
    </html>
  );
}
