import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TooltipFrame = ({
  tooltipContent,
  children,
  asChild = false,
}: {
  tooltipContent: string;
  children: React.ReactNode;
  asChild?: boolean;
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent sm="top" md="top" lg="right" xl="right" side="right">
          <span className="text-textPrimary bg-bgContainer border-[1px] font-medium rounded-md font-main text-xs border-borderDefault p-1">
            {tooltipContent}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TooltipFrame;
