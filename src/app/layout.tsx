import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tokyo Train Orchestra',
  description: 'A living orchestra driven by Tokyo Metro train arrivals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 overflow-hidden">{children}</body>
    </html>
  );
}
