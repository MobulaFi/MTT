'use client';
import StatsCard from '@/components/shared/StatsCard';
import { usePairStore } from '@/features/pair/store/pairStore';
import { PairStatsCardSkeleton } from '@/components/skeleton';
import { buildPair } from '@/utils/StatsCardAdapter';

export default function PairStatsCards() {
  const { data: pair, isLoading, error } = usePairStore();
  if (isLoading || !pair) return <PairStatsCardSkeleton />;
  return <StatsCard data={buildPair(pair)} />;
}

