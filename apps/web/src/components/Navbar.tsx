'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gauge,
  PlayCircle,
  Users,
  Layers,
  Search,
  History,
  Key,
  Webhook,
  ShieldAlert,
  FileCode2,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/demo', label: 'Interactive Demo', icon: PlayCircle, highlight: true },
  { href: '/users', label: 'Accounts & Users', icon: Users },
  { href: '/plans', label: 'Plans & Limits', icon: Layers },
  { href: '/inspector', label: 'Request Inspector', icon: Search },
  { href: '/history', label: 'History & CSV', icon: History },
  { href: '/api-keys', label: 'API Keys', icon: Key },
  { href: '/webhooks', label: 'Webhooks & Alerts', icon: Webhook },
  { href: '/audit', label: 'Audit Log', icon: ShieldAlert },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Quota<span className="text-brand-600">Flow</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Usage Metering & Quotas
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-brand-500/20'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-brand-600 font-semibold dark:bg-slate-800 dark:text-brand-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action / Swagger Documentation */}
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:4000/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <FileCode2 className="h-3.5 w-3.5 text-emerald-500" />
            Swagger Docs
          </a>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            API Ready
          </span>
        </div>
      </div>
    </header>
  );
}
