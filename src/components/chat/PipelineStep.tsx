import { cn } from "@/lib/utils";
import { Check, X, Loader2, Circle, Minus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped" | "needs_approval";

export interface PipelineStepData {
  id: string;
  title: string;
  status: StepStatus;
  details?: string;
  richContent?: any;
}

const statusIcons: Record<StepStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  done: <Check className="h-4 w-4 text-green-500" />,
  error: <X className="h-4 w-4 text-destructive" />,
  skipped: <Minus className="h-4 w-4 text-muted-foreground" />,
  needs_approval: <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />,
};

export function PipelineStep({ step, isLast }: { step: PipelineStepData; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!step.details;

  return (
    <div className="flex gap-3">
      {/* Vertical line + icon */}
      <div className="flex flex-col items-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
          {statusIcons[step.status]}
        </div>
        {!isLast && (
          <div className={cn(
            "w-px flex-1 min-h-[16px]",
            step.status === "done" ? "bg-green-500/40" : "bg-border"
          )} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        {hasDetails ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="text-sm font-medium hover:underline cursor-pointer text-left">
              <span className={cn(
                step.status === "done" && "text-green-600 dark:text-green-400",
                step.status === "error" && "text-destructive",
                step.status === "skipped" && "text-muted-foreground line-through",
                step.status === "running" && "text-foreground",
                step.status === "pending" && "text-muted-foreground",
              )}>
                {step.title}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{step.details}</p>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className={cn(
            "text-sm font-medium",
            step.status === "done" && "text-green-600 dark:text-green-400",
            step.status === "error" && "text-destructive",
            step.status === "skipped" && "text-muted-foreground line-through",
            step.status === "running" && "text-foreground",
            step.status === "pending" && "text-muted-foreground",
          )}>
            {step.title}
          </p>
        )}
      </div>
    </div>
  );
}
