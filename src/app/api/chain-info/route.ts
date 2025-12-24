import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');

  if (!chainId) {
    return NextResponse.json({ error: 'Chain ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://chainlist.org/rpcs.json');
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch chain list' }, { status: 500 });
    }

    const chains = await response.json() as Array<{
      chainId: number;
      name: string;
      rpc: Array<{ url: string }>;
      nativeCurrency?: {
        name: string;
        symbol: string;
        decimals: number;
      };
      explorers?: Array<{ url: string }>;
    }>;

    const chainIdNum = parseInt(chainId, 10);
    const chainData = chains.find((chain) => chain.chainId === chainIdNum);

    if (!chainData) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json(chainData);
  } catch (error) {
    console.error('Error fetching chain info:', error);
    return NextResponse.json({ error: 'Failed to fetch chain info' }, { status: 500 });
  }
}

