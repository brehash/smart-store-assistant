import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Square, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  planMode?: boolean;
  onPlanModeToggle?: () => void;
}

export function ChatInput({ onSend, onStop, disabled, isStreaming, planMode, onPlanModeToggle }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && !isStreaming) textareaRef.current?.focus();
  }, [disabled, isStreaming]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-card p-2 sm:p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {onPlanModeToggle && (
          <Button
            variant={planMode ? "default" : "outline"}
            size="icon"
            className={cn("shrink-0 h-9 w-9 sm:h-[44px] sm:w-[44px]", planMode && "bg-amber-500 hover:bg-amber-600 text-white")}
            onClick={onPlanModeToggle}
            title={planMode ? "Plan Mode ON" : "Plan Mode OFF"}
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={planMode ? "Descrie ce vrei să faci..." : "Întreabă despre produse, comenzi, analize..."}
          className="min-h-[44px] max-h-[160px] resize-none bg-background"
          rows={1}
          disabled={disabled && !isStreaming}
        />
        {isStreaming ? (
          <Button
            onClick={onStop}
            variant="destructive"
            size="icon"
            className="shrink-0 h-9 w-9 sm:h-[44px] sm:w-[44px]"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            size="icon"
            className="shrink-0 h-9 w-9 sm:h-[44px] sm:w-[44px]"
          >
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {planMode && (
        <p className="mx-auto max-w-3xl text-xs text-amber-600 mt-1.5 pl-[52px]">
          Plan Mode — AI-ul va analiza cererea și va propune un plan fără a executa acțiuni.
        </p>
      )}
    </div>
  );
}
