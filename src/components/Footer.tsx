import Image from 'next/image';
import Link from 'next/link';
import { ThemeHoverCard } from '@/components/ThemeHoverCard';

const links = [
  { name: 'Docs', href: 'https://docs.mobula.io/introduction' },
  { name: 'Support', href: 'https://t.me/mobuladevelopers' },
];

export function Footer() {
  return (
    <footer className="w-full border-y border-borderDefault bg-bgPrimary py-[6px] px-4 flex items-center justify-between mt-auto">
      <div className="flex items-center space-x-3">
        <Link href="https://mobula.io/" target="_blank" rel="noopener noreferrer">
          <Image src="/mobula.svg" alt="Mobula Logo" width={15} height={15} priority />
        </Link>
        <ThemeHoverCard />
      </div>
      <div className="flex space-x-6 text-xs font-normal text-textPrimary">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-success transition-colors"
          >
            {link.name}
          </Link>
        ))}
      </div>
    </footer>
  );
}