'use client';

import { use } from 'react';
import AssetPageClient from '@/features/asset/components/AssetPageClient';

interface PairPageProps {
  params: Promise<{ blockchain: string; address: string }>;
}

export default function PairPage({ params }: PairPageProps) {
  const { blockchain, address } = use(params);
  return <AssetPageClient address={address} blockchain={decodeURIComponent(blockchain)} isPair={true} />;
}
