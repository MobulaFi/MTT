import { useState } from "react";
import { LucideIcon } from "lucide-react";

interface TokenMetricsCardProps {
  label: string;
  value: string | number;
  count?: string | number;
  iconColor?: string;
  textColor?: string;
  icon?: LucideIcon;
}

const TokenMetricsCard = ({
  label,
  value,
  count,
  iconColor,
  textColor = "text-grayMedium",
  icon: Icon,
}: TokenMetricsCardProps) => {
  const [hovered, setHovered] = useState(false);
  const hasCount = count !== undefined && count !== null && count !== "";

  return (
    <div
      className={`relative w-full h-full p-2 text-center flex items-center justify-center transition-colors duration-200 ${
        hasCount ? "cursor-pointer" : ""
      }`}
      onMouseEnter={() => hasCount && setHovered(true)}
      onMouseLeave={() => hasCount && setHovered(false)}
    >
      {hasCount && (
        <div
          className={`absolute inset-0 bg-bgTertiary transition-opacity duration-200 pointer-events-none ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      <div className="relative z-10 grid grid-rows-2 gap-1 items-center justify-center w-full h-full">
        {/* Row 1: Main value / count */}
        <div className="flex items-center justify-center gap-2 min-h-[1.25rem]">
          {!hovered ? (
            <>
              {Icon && <Icon size={14} className={iconColor} />}
              <div className={`font-medium text-sm ${textColor} leading-tight`}>
                {value}
              </div>
            </>
          ) : (
            hasCount && (
              <div className="text-sm font-normal text-success leading-tight">
                {count}
              </div>
            )
          )}
        </div>

        <div className="text-xs text-grayMedium leading-tight">{label}</div>
      </div>
    </div>
  );
};

export default TokenMetricsCard;

