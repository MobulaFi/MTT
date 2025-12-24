import {
    Zap,
    Brain,
    Sparkles,
    ChefHat,
    Crosshair,
    Ghost,
    Boxes,
  } from 'lucide-react';
  

export const HOLDER_TAG_ICONS: Record<string, JSX.Element> = {
  sniper: <Crosshair size={13} className='text-success hover:text-success/50' />,
  insider: <Ghost size={13} className='text-success hover:text-success/50' />,
  bundler: <Boxes size={13} className='text-success hover:text-success/50'  />,
  dev: <ChefHat size={13} className='text-success hover:text-success/50' />,
  proTrader: <Brain size={13} className='text-success hover:text-success/50' />,
  smartTrader: <Sparkles size={13} className='text-success hover:text-success/50'  />,
  freshTrader: <Zap size={13} className='text-success hover:text-success/50'  />,
};
  