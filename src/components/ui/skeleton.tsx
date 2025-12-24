import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-bgPrimary',
        // Use CSS gradient with custom properties for theme-aware skeleton
        '[background:linear-gradient(90.06deg,var(--bg-primary)_-2.83%,var(--bg-tableHover)_99.95%)]',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
