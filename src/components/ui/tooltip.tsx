'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import * as React from 'react';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;

// Correct: No hardcoded asChild
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ children, ...props }, ref) => (
  <TooltipPrimitive.Trigger ref={ref} {...props}>
    {children}
  </TooltipPrimitive.Trigger>
));
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    sm?: TooltipSide;
    md?: TooltipSide;
    lg?: TooltipSide;
    xl?: TooltipSide;
    side?: TooltipSide;
    sideOffset?: number;
  }
>(
  (
    {
      className,
      sm,
      md,
      lg,
      xl,
      side = 'top',
      sideOffset = 4,
      ...props
    },
    ref
  ) => {
    const getSide = () => sm || md || lg || xl || side;

    const sideClass = cn(
      sm ? `sm:data-[side=${sm}]` : '',
      md ? `md:data-[side=${md}]` : '',
      lg ? `lg:data-[side=${lg}]` : '',
      xl ? `xl:data-[side=${xl}]` : ''
    );

    return (
      <TooltipPrimitive.Content
        ref={ref}
        side={getSide()}
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md bg-bgContainer px-3 py-1.5 text-xs font-medium text-textPrimary shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=bottom]:slide-in-from-top-2',
          sideClass,
          className
        )}
        {...props}
      />
    );
  }
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };