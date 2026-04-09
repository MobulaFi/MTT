import type React from 'react';
import { useEffect, useState } from 'react';

interface TimeAgoProps {
  timestamp: string | Date | null | undefined;
  textColor?: string;
}

export function getTimeAgo(timestamp: string | Date): string {
  const then = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp.getTime();
  const now = Date.now();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}


const TimeAgo: React.FC<TimeAgoProps> = ({ timestamp, textColor = 'text-success' }) => {
  const [timeAgo, setTimeAgo] = useState<string>(
    timestamp ? getTimeAgo(timestamp) : '-'
  );

  useEffect(() => {
    if (!timestamp) return;

    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(timestamp));
    }, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp) {
    return <span className={`${textColor} text-xs flex-shrink-0`}>-</span>;
  }

  return <span className={`${textColor} text-xs flex-shrink-0`}>{timeAgo}</span>;
};

export default TimeAgo;
