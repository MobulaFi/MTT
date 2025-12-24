// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/sonner"
import { EIP6963Initializer } from '@/components/wallet/EIP6963Initializer';
import { WalletPortfolioModalWrapper } from '@/components/shared/WalletPortfolioModalWrapper';

export const metadata = {
  title: 'Mobula Trading Terminal',
  description: 'Mobula Trading Terminal is a lightweight example repository for the Mobula SDK',
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
        <EIP6963Initializer />
        <Toaster />
          <div className="flex flex-col min-h-screen relative">
            <header className="sticky top-0 z-50">
              <Header />
            </header>
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
            <footer className="sticky bottom-0 z-50">
              <Footer />
            </footer>
          </div>
          <WalletPortfolioModalWrapper />
      </body>
    </html>
  );
}