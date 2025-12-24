'use client';

import { format, formatDistanceToNowStrict } from 'date-fns';

interface ToggleTimeCellProps {
  timestamp: number | string; // Unix or ISO string
  showAbsoluteTime: boolean;
}

export function ToggleTimeCell({ timestamp, showAbsoluteTime }: ToggleTimeCellProps) {
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);

  const display = showAbsoluteTime
    ? format(date, 'yyyy-MM-dd HH:mm')
    : formatDistanceToNowStrict(date, { addSuffix: false }); // e.g., "10h"

  return (
    <span className="text-primary-manatee cursor-default" title={format(date, 'yyyy-MM-dd HH:mm:ss')}>
      {display}
    </span>
  );
}
