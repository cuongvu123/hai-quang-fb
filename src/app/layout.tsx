import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hải Quang — Cổng tin cộng đồng AI',
  description: 'Tự động tổng hợp & hỗ trợ đăng tin cộng đồng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
