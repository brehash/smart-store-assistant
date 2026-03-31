import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil } from "lucide-react";

interface ApprovalCardProps {
  summary: string;
  details?: string;
  onApprove: () => void;
  onSkip: () => void;
  onEdit: (editedText: string) => void;
  disabled?: boolean;
  resolved?: "approved" | "skipped" | "edited";
}

export function ApprovalCard({ summary, details, onApprove, onSkip, onEdit, disabled, resolved }: ApprovalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(details || summary);

  if (resolved) {
    const labels = { approved: "Aprobat", skipped: "Omis", edited: "Editat & Aprobat" };
    const colors = { approved: "text-green-600", skipped: "text-muted-foreground", edited: "text-amber-600" };
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 my-2">
        <p className="text-sm text-muted-foreground">{summary}</p>
        <p className={`text-xs font-medium mt-1 ${colors[resolved]}`}>{labels[resolved]}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 my-2">
      <p className="text-sm font-medium">{summary}</p>
      {details && !editing && (
        <p className="text-xs text-muted-foreground mt-1">{details}</p>
      )}
      {editing && (
        <Input
          className="mt-2 text-sm"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onEdit(editText);
              setEditing(false);
            }
          }}
        />
      )}
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onApprove} disabled={disabled} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onSkip} disabled={disabled} className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Skip
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} disabled={disabled} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>
    </div>
  );
}
