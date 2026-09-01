import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Automates en MPI',
  description: 'Exercices sur les automates finis.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Automates en MPI',
    description: 'Exercices sur les automates finis.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'Automates en MPI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Automates en MPI',
    description: 'Exercices sur les automates finis.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
