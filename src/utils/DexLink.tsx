import { Pill } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';

// Interface for DexLink props
interface DexLinkProps {
  token: string; // Exchange name (e.g., pumpfun, pumpswap, boop, gte, moonshot)
  logo: string; // Logo URL or path
  tokenAddress: string; // Token pair address
}

// Function to construct the URL based on exchange name
const getExchangeUrl = (exchangeName: string, tokenAddress: string): string => {
  const baseUrls: { [key: string]: string } = {
    pumpfun: 'https://pump.fun/coin',
    pumpswap: 'https://pump.fun/coin',
    boop: 'https://boop.fun/tokens', // Placeholder, replace with actual URL
    gte: 'https://testnet.gte.xyz/token', // Placeholder, replace with actual URL
  };

  const normalizedExchangeName = exchangeName.toLowerCase();

  return baseUrls[normalizedExchangeName] ? `${baseUrls[normalizedExchangeName]}/${tokenAddress}` : '#';
};

const DexLink: React.FC<DexLinkProps> = ({ token, tokenAddress }) => {
  const href = getExchangeUrl(token, tokenAddress);
  return (
    <Link href={href} target="_blank" className="flex items-center gap-1">
        <Pill size={15} className='text-textPrimary hover:text-success' />
    </Link>
  );
};

export default DexLink;
