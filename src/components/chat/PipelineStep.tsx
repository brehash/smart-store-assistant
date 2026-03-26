import { cn } from "@/lib/utils";
import { Check, X, Loader2, Circle, Minus } from "lucide-react";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped" | "needs_approval";

export interface PipelineStepData {
  id: string;
  title: string;
  status: StepStatus;
  details?: string;
  richContent?: any;
}

const statusIcons: Record<StepStatus, React.ReactNode> = {
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />,
  done: <Check className="h-3.5 w-3.5 text-green-500" />,
  error: <X className="h-3.5 w-3.5 text-destructive" />,
  skipped: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
  needs_approval: <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />,
};

export function PipelineStep({ step }: { step: PipelineStepData }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="flex h-5 w-5 items-center justify-center shrink-0">
        {statusIcons[step.status]}
      </div>
      <div className="flex flex-col">
        <span className={cn(
          "text-sm",
          step.status === "done" && "text-green-600 dark:text-green-400",
          step.status === "error" && "text-destructive",
          step.status === "skipped" && "text-muted-foreground line-through",
          step.status === "running" && "text-foreground font-medium",
          step.status === "needs_approval" && "text-amber-600 dark:text-amber-400 font-medium",
          step.status === "pending" && "text-muted-foreground",
        )}>
          {step.title}
        </span>
        {step.details && (
          <span className="text-xs text-muted-foreground mt-0.5">{step.details}</span>
        )}
      </div>
    </div>
  );
}
