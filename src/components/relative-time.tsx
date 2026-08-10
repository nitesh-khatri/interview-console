import { fmtDateTime, fmtRelative } from "@/lib/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RelativeTimeProps = {
  value: string | null;
};

export function RelativeTime({ value }: RelativeTimeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          data-testid="relative-time"
          dateTime={value ?? ""}
          tabIndex={0}
        >
          {fmtRelative(value)}
        </time>
      </TooltipTrigger>

      <TooltipContent>
        {fmtDateTime(value)}
      </TooltipContent>
    </Tooltip>
  );
}