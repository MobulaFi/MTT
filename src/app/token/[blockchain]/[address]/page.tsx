'use client';

import { use } from 'react';
import AssetPageClient from '@/features/asset/components/AssetPageClient';

interface TokenPageProps {
  params: Promise<{ blockchain: string; address: string }>;
}

export default function TokenPage({ params }: TokenPageProps) {
  const { blockchain, address } = use(params);
  return <AssetPageClient address={address} blockchain={decodeURIComponent(blockchain)} isPair={false} />;
}
