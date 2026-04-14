import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-jp',
});

export const metadata: Metadata = {
  title: '東京電車オーケストラ | Tokyo Train Orchestra',
  description: 'A living orchestra driven by Tokyo Metro train arrivals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} bg-slate-950 overflow-hidden font-sans`}>{children}</body>
    </html>
  );
}
