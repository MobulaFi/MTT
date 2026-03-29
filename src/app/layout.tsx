// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/sonner"
import { WalletPortfolioModalWrapper } from '@/components/shared/WalletPortfolioModalWrapper';
import { ReclaimATAModalWrapper } from '@/features/reclaim-ata/components/ReclaimATAModalWrapper';
import { PrivyClientProvider } from '@/components/providers/PrivyClientProvider';
import DataPreloader from '@/components/DataPreloader';
import { UserPortfolioProvider } from '@/components/providers/UserPortfolioProvider';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'Hawk Trading Terminal',
  description: 'Hawk Trading Terminal - Real-time trading terminal powered by Hawk',
  icons: {
    icon: '/hawk.jpg',
    apple: '/hawk.jpg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme-storage');
                  if (stored) {
                    const { state } = JSON.parse(stored);
                    if (state?.colors) {
                      const c = state.colors;
                      const root = document.documentElement.style;
                      root.setProperty('--bg-primary', c.bgPrimary);
                      root.setProperty('--success', c.success);
                      root.setProperty('--bg-overlay', c.bgOverlay);
                      root.setProperty('--bg-tableAlt', c.bgTableAlt);
                      root.setProperty('--bg-tableHover', c.tableHover);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-menlo w-full bg-bgPrimary text-foreground" suppressHydrationWarning>
        <PrivyClientProvider>
          <DataPreloader />
          <UserPortfolioProvider />
          <Toaster />
          <div className="flex flex-col h-screen overflow-hidden relative">
            <header className="sticky top-0 z-50">
              <Header />
            </header>
            <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              <AppShell>{children}</AppShell>
            </main>
            <footer className="sticky bottom-0 z-50">
              <Footer />
            </footer>
          </div>
          <WalletPortfolioModalWrapper />
          <ReclaimATAModalWrapper />
        </PrivyClientProvider>
      </body>
    </html>
  );
}
