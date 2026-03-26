import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReasoningEntry {
  text: string;
  timestamp: number;
}

interface ReasoningBubblesProps {
  entries: ReasoningEntry[];
  isStreaming: boolean;
}

export function ReasoningBubbles({ entries, isStreaming }: ReasoningBubblesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!entries.length) return null;

  const durationSec = entries.length > 1
    ? Math.round((entries[entries.length - 1].timestamp - entries[0].timestamp) / 1000)
    : 0;

  const hasError = entries.some((e) => e.text.startsWith("Error:"));

  // While streaming: show only the latest thought as a single fading line
  if (isStreaming) {
    const latest = entries[entries.length - 1];

    return (
      <div className="flex flex-col gap-1 my-1 w-full max-w-[520px]">
        <div className="flex items-start gap-1.5 animate-reasoning-in">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
          <span className="text-xs italic text-muted-foreground leading-snug whitespace-pre-wrap">
            {latest.text}
          </span>
        </div>
      </div>
    );
  }

  // Collapsed state: single summary line with expand
  const summaryLabel = hasError
    ? `Process stopped after ${entries.length} steps`
    : `Thought for ${durationSec}s · ${entries.length} steps`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-1 w-full max-w-[400px]">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors group cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
        <span className="italic">
          {summaryLabel}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="flex flex-col gap-0.5 pl-4 border-l border-border/50">
          {entries.map((entry, i) => (
            <div key={`${entry.timestamp}-${i}`} className="flex items-start gap-1.5">
              <span className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                entry.text.startsWith("Error:") ? "bg-destructive" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "text-xs italic leading-snug",
                entry.text.startsWith("Error:") ? "text-destructive" : "text-muted-foreground"
              )}>
                {entry.text}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
