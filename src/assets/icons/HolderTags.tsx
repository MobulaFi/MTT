import {
    Zap,
    Brain,
    Sparkles,
    ChefHat,
    Crosshair,
    Ghost,
    Boxes,
    Droplets,
  } from 'lucide-react';
  

export const HOLDER_TAG_ICONS: Record<string, JSX.Element> = {
  sniper: <Crosshair size={13} className='text-success hover:text-success/50' />,
  insider: <Ghost size={13} className='text-success hover:text-success/50' />,
  bundler: <Boxes size={13} className='text-success hover:text-success/50'  />,
  dev: <ChefHat size={13} className='text-success hover:text-success/50' />,
  proTrader: <Brain size={13} className='text-success hover:text-success/50' />,
  smartTrader: <Sparkles size={13} className='text-success hover:text-success/50'  />,
  freshTrader: <Zap size={13} className='text-success hover:text-success/50'  />,
  liquidityPool: <Droplets size={13} className='text-blue-400 hover:text-blue-400/50' />,
};

// Labels that should display as a prominent badge instead of just an icon
export const PROMINENT_LABELS: Record<string, { text: string; className: string }> = {
  liquidityPool: { 
    text: 'LIQUIDITY POOL', 
    className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
  },
};
  