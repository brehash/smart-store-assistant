import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Pencil, ThumbsUp, ThumbsDown, RefreshCw, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface UserMessageActionsProps {
  content: string;
  onEditAndResend?: (newText: string) => void;
}

export function UserMessageActions({ content, onEditAndResend }: UserMessageActionsProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ description: "Copiat în clipboard" });
  };

  if (editing) {
    return (
      <div className="w-full flex flex-col gap-2 mt-1">
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="min-h-[60px] text-sm"
          autoFocus
        />
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5 mr-1" /> Anulează
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const trimmed = editText.trim();
              if (trimmed && onEditAndResend) {
                onEditAndResend(trimmed);
                setEditing(false);
              }
            }}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Retrimite
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} title="Copiază">
        <Copy className="h-3 w-3" />
      </Button>
      {onEditAndResend && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditText(content); setEditing(true); }} title="Editează și retrimite">
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface AssistantMessageActionsProps {
  content: string;
  messageId?: string;
  feedbackRating?: "up" | "down" | null;
  onRetry?: () => void;
  onFeedback?: (rating: "up" | "down") => void;
  isStreaming?: boolean;
}

export function AssistantMessageActions({ content, feedbackRating, onRetry, onFeedback, isStreaming }: AssistantMessageActionsProps) {
  const { toast } = useToast();

  if (isStreaming) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ description: "Copiat în clipboard" });
  };

  return (
    <div className="flex gap-0.5 mt-1">
      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleCopy} title="Copiază">
        <Copy className="h-3 w-3" />
      </Button>
      {onFeedback && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", feedbackRating === "up" ? "text-green-500" : "text-muted-foreground hover:text-foreground")}
            onClick={() => onFeedback("up")}
            title="Bun"
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", feedbackRating === "down" ? "text-red-500" : "text-muted-foreground hover:text-foreground")}
            onClick={() => onFeedback("down")}
            title="Rău"
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
        </>
      )}
      {onRetry && (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onRetry} title="Încearcă din nou">
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
