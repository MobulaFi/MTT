import { useCallback, useState, useMemo } from "react";
import Image from "next/image";

interface ProtocolSelectorProps {
    selectedProtocols: string[];
    onChange: (protocols: string[]) => void;
    availableProtocols?: Protocol[];
}

export interface Protocol {
    id: string;
    name: string;
    icon: string;
}


export const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({ selectedProtocols, onChange, availableProtocols }) => {
    const [showAll, setShowAll] = useState(false);

    const protocols = availableProtocols || [];
    
    // Get unique protocols - keep only one if names are same, prioritize by ID
    const uniqueProtocols = useMemo(() => {
        const seen = new Map<string, Protocol>();
        const seenNames = new Set<string>();

        protocols.forEach(protocol => {
            if (seen.has(protocol.id)) {
                return;
            }
            if (seenNames.has(protocol.name)) {
                return;
            }

            seen.set(protocol.id, protocol);
            seenNames.add(protocol.name);
        });

        return Array.from(seen.values());
    }, [protocols]);

    const uniqueMain = uniqueProtocols.slice(0, 5);
    const uniqueAdditional = uniqueProtocols.slice(5);

    const toggleProtocol = useCallback((protocolId: string): void => {
        const newSelected = selectedProtocols.includes(protocolId)
            ? selectedProtocols.filter((id) => id !== protocolId)
            : [...selectedProtocols, protocolId];
        onChange(newSelected);
    }, [selectedProtocols, onChange]);

    return (
        <div className="space-y-2">
            {/* Main protocols row */}
            <div className="flex flex-wrap gap-2 items-center">
                {uniqueMain.map((protocol) => (
                    <button
                        key={protocol.id}
                        onClick={() => toggleProtocol(protocol.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 font-geist text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border
                ${selectedProtocols.includes(protocol.name)
                                ? 'bg-success/10 border-success/40 text-success'
                                : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary'
                            }
              `}
                    >
                        <Image src={protocol.icon} width={10} height={10} alt={protocol.name} priority/>
                        {protocol.name}
                    </button>
                ))}

                {/* Expand/Collapse button if more protocols exist */}
                {uniqueAdditional.length > 0 && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className={`p-1.5 text-xs font-semibold transition-all border ${showAll
                            ? 'border-success/40 text-success hover:bg-success/10'
                            : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary'
                            }`}
                    >
                        <svg
                            className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Expanded protocols */}
            {showAll && uniqueAdditional.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {uniqueAdditional.map((protocol) => (
                        <button
                            key={protocol.id}
                            onClick={() => toggleProtocol(protocol.name)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 font-geist text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border
                  ${selectedProtocols.includes(protocol.name)
                                    ? 'bg-success/10 border-success/40 text-success'
                                    : 'bg-bgContainer/5 border-borderDarkSlateGray text-grayCool hover:border-borderDefault hover:text-textPrimary'
                                }
                `}
                        >
                           <Image src={protocol.icon} width={10} height={10} alt={protocol.name} priority />
                            {protocol.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};