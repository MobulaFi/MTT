'use client';

import { ReactNode, useEffect } from 'react';
import { EmbedConfig, getThemeFromBgColor } from '@/lib/embed/validateEmbedParams';

interface EmbedLayoutProps {
  children: ReactNode;
  config: EmbedConfig;
}

function EmbedBodyStyles({ config }: { config: EmbedConfig }) {
  useEffect(() => {
    const bgColor = config.bgColor || '#121319';
    const theme = getThemeFromBgColor(bgColor);
    const isLight = theme === 'light';
    
    // Hide header and footer
    const header = document.querySelector('header') as HTMLElement | null;
    const footer = document.querySelector('footer') as HTMLElement | null;
    const mainWrapper = document.querySelector('body > div') as HTMLElement | null;
    
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (mainWrapper) {
      mainWrapper.style.margin = '0';
      mainWrapper.style.padding = '0';
    }
    
    // Set body styles
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = bgColor;
    
    // Set TradingView CSS variables for toolbars based on theme
    const root = document.documentElement;
    if (isLight) {
      root.style.setProperty('--tv-color-platform-background', '#ffffff');
      root.style.setProperty('--tv-color-pane-background', '#ffffff');
      root.style.setProperty('--tv-color-pane-background-secondary', '#ffffff');
      root.style.setProperty('--tv-color-toolbar-button-background-hover', '#f3f4f6');
      root.style.setProperty('--tv-color-toolbar-button-background-secondary-hover', '#f3f4f6');
      root.style.setProperty('--tv-color-toolbar-button-background-expanded', '#f3f4f6');
      root.style.setProperty('--tv-color-toolbar-button-text', 'rgba(0, 0, 0, 0.8)');
      root.style.setProperty('--tv-color-toolbar-button-text-hover', '#18C722');
      root.style.setProperty('--tv-color-toolbar-button-text-active', 'rgba(0, 0, 0, 0.9)');
      root.style.setProperty('--tv-color-toolbar-button-text-active-hover', '#18C722');
      root.style.setProperty('--tv-color-item-active-text', '#18C722');
      root.style.setProperty('--tv-color-toolbar-toggle-button-background-active', '#f3f4f6');
      root.style.setProperty('--tv-color-toolbar-toggle-button-background-active-hover', '#e5e7eb');
    } else {
      root.style.setProperty('--tv-color-platform-background', '#121319');
      root.style.setProperty('--tv-color-pane-background', '#121319');
      root.style.setProperty('--tv-color-pane-background-secondary', '#121319');
      root.style.setProperty('--tv-color-toolbar-button-background-hover', '#1a1c23');
      root.style.setProperty('--tv-color-toolbar-button-background-secondary-hover', '#1a1c23');
      root.style.setProperty('--tv-color-toolbar-button-background-expanded', '#1a1c23');
      root.style.setProperty('--tv-color-toolbar-button-text', 'rgba(255, 255, 255, 0.95)');
      root.style.setProperty('--tv-color-toolbar-button-text-hover', '#18C722');
      root.style.setProperty('--tv-color-toolbar-button-text-active', '#18C722');
      root.style.setProperty('--tv-color-toolbar-button-text-active-hover', '#18C722');
      root.style.setProperty('--tv-color-item-active-text', '#18C722');
      root.style.setProperty('--tv-color-toolbar-toggle-button-background-active', '#1a1c23');
      root.style.setProperty('--tv-color-toolbar-toggle-button-background-active-hover', '#1a1c23');
    }
    
    // Cleanup on unmount
    return () => {
      const cleanupHeader = document.querySelector('header') as HTMLElement | null;
      const cleanupFooter = document.querySelector('footer') as HTMLElement | null;
      const cleanupMainWrapper = document.querySelector('body > div') as HTMLElement | null;
      
      if (cleanupHeader) cleanupHeader.style.display = '';
      if (cleanupFooter) cleanupFooter.style.display = '';
      if (cleanupMainWrapper) {
        cleanupMainWrapper.style.margin = '';
        cleanupMainWrapper.style.padding = '';
      }
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflow = '';
      document.body.style.backgroundColor = '';
      
      // Reset CSS variables
      const root = document.documentElement;
      root.style.removeProperty('--tv-color-platform-background');
      root.style.removeProperty('--tv-color-pane-background');
      root.style.removeProperty('--tv-color-pane-background-secondary');
      root.style.removeProperty('--tv-color-toolbar-button-background-hover');
      root.style.removeProperty('--tv-color-toolbar-button-background-secondary-hover');
      root.style.removeProperty('--tv-color-toolbar-button-background-expanded');
      root.style.removeProperty('--tv-color-toolbar-button-text');
      root.style.removeProperty('--tv-color-toolbar-button-text-hover');
      root.style.removeProperty('--tv-color-toolbar-button-text-active');
      root.style.removeProperty('--tv-color-toolbar-button-text-active-hover');
      root.style.removeProperty('--tv-color-item-active-text');
      root.style.removeProperty('--tv-color-toolbar-toggle-button-background-active');
      root.style.removeProperty('--tv-color-toolbar-toggle-button-background-active-hover');
    };
  }, [config.bgColor]);

  return null;
}

/**
 * EmbedLayout - Minimal layout wrapper for iframe embeds
 * - Hides navbar and footer via client-side styles
 * - Sets body margin 0, overflow hidden
 * - Applies background color from config
 */
export function EmbedLayout({ children, config }: EmbedLayoutProps) {
  return (
    <>
      <EmbedBodyStyles config={config} />
      <div style={{ margin: 0, padding: 0, width: '100%', height: '100vh', overflow: 'hidden' }}>
        {children}
      </div>
    </>
  );
}

