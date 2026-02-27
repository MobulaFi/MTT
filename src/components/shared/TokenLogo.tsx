"use client";
import { useState } from "react";
import SafeImage from "@/components/SafeImage";

interface TokenLogoProps {
    logo?: string | null;
    symbol?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
}

/**
 * Token logo component with first-letter fallback and automatic retry.
 * Shows the token logo if available, otherwise shows a styled placeholder
 * with blue accent border and the first letter of the name.
 */
export function TokenLogo({ logo, symbol, name, size = 20, className = "" }: TokenLogoProps) {
    const displayText = name ?? symbol ?? '?';
    const letter = displayText.charAt(0).toUpperCase();
    const [showFallback, setShowFallback] = useState(!logo);

    if (!logo || showFallback) {
        return (
            <div
                className={`rounded-full bg-[#0a0f1a] border border-blue-500/50 flex items-center justify-center flex-shrink-0 ${className}`}
                style={{ width: size, height: size }}
                title={displayText}
            >
                <span
                    className="text-blue-400 font-semibold tracking-wide select-none"
                    style={{ fontSize: size * 0.45, lineHeight: 1 }}
                >
                    {letter}
                </span>
            </div>
        );
    }

    return (
        <SafeImage
            src={logo}
            width={size}
            height={size}
            className={`rounded-full flex-shrink-0 ${className}`}
            alt={displayText}
            onError={() => setShowFallback(true)}
        />
    );
}

export default TokenLogo;



