import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
  { href: '/sources', label: 'Nguồn dữ liệu', icon: '🌐' },
  { href: '/news', label: 'Tin đã thu thập', icon: '📰' },
  { href: '/drafts', label: 'Bài AI chờ duyệt', icon: '✍️' },
  { href: '/calendar', label: 'Lịch đăng bài', icon: '📅' },
  { href: '/settings', label: 'Cài đặt', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold">Hải Quang</p>
          <p className="text-xs text-neutral-500">Cổng tin cộng đồng AI</p>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100"
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
