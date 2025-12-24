import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function CopyAddress({
    display,
    value,
  }: {
    display: string;      
    value: string;      
  }) {
    const [copied, setCopied] = useState(false);
  
    const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
  
      navigator.clipboard.writeText(value).then(() => {
        toast.success('Address copied to clipboard', {
          duration: 2000,
          icon: <Check className="w-4 h-4 text-success" />,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 800);
      }).catch(() => {
        toast.error('Failed to copy address');
      });
    };
  
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 text-textTertiary hover:text-success transition"
      >
        <span className="font-bold text-textPrimary text-base truncate">{display}</span>
        {copied ? (
          <Check className="w-3 h-3 text-success" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    );
  }
  