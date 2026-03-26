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

  // While streaming: show last 4 thoughts
  if (isStreaming) {
    const visible = entries.slice(-4);
    const hidden = entries.length - visible.length;

    return (
      <div className="flex flex-col gap-0.5 my-1 w-full max-w-[400px]">
        {hidden > 0 && (
          <span className="text-[10px] text-muted-foreground/50 italic pl-5">
            +{hidden} earlier thoughts
          </span>
        )}
        {visible.map((entry, i) => {
          const isLatest = i === visible.length - 1;
          return (
            <div
              key={`${entry.timestamp}-${i}`}
              className={cn(
                "flex items-start gap-1.5 animate-reasoning-in",
                !isLatest && "opacity-60"
              )}
            >
              {isLatest ? (
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
              ) : (
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
              )}
              <span className="text-xs italic text-muted-foreground leading-snug">
                {entry.text}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Collapsed state: "Thought for Xs" with expand
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-1 w-full max-w-[400px]">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors group cursor-pointer">
        <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
        <span className="italic">
          Thought for {durationSec}s · {entries.length} steps
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="flex flex-col gap-0.5 pl-4 border-l border-border/50">
          {entries.map((entry, i) => (
            <div key={`${entry.timestamp}-${i}`} className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
              <span className="text-xs italic text-muted-foreground leading-snug">
                {entry.text}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
