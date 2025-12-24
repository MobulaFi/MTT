import { formatPercentage } from '@mobula_labs/sdk';

interface TimeframeChangeProps {
  label: string;
  value: number | string | null | undefined;
}

export const TimeframeChange: React.FC<TimeframeChangeProps> = ({ label, value }) => {
  const display = !value || Number(value) === 0 ? 'N/A' : formatPercentage(value);

  // Color for the value text
  const valueColorClass =
    !value || Number(value) === 0 ? 'text-grayDark' : Number(value) > 0 ? 'text-success' : 'text-red-500';

  // Color for the label text
  const labelColorClass = !value || Number(value) === 0 ? 'text-grayMedium' : 'text-textPrimary';

  return (
    <div className="flex flex-col space-y-1">
      <div className={`text-center font-menlo text-[11.6px] font-extrabold leading-[18px] uppercase ${labelColorClass}`}>
        {label}
      </div>
      <div className={`text-center font-menlo text-[13.3px] font-extrabold leading-[21px] uppercase ${valueColorClass}`}>
        {display}
      </div>
    </div>
  );
};
