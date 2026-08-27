import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'README Verifier — Mission Control',
  description: 'Watch the readme-verifier agent verify a repository README live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
