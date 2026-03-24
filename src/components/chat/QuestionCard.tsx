import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuestionCardProps {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  resolved?: string;
}

export function QuestionCard({ question, options, onAnswer, disabled, resolved }: QuestionCardProps) {
  const [otherText, setOtherText] = useState("");

  if (resolved) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 my-2">
        <p className="text-sm text-muted-foreground">{question}</p>
        <p className="text-sm font-medium mt-1 text-primary">→ {resolved}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 my-2">
      <p className="text-sm font-medium mb-3">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options?.map((opt) => (
          <Button key={opt} size="sm" variant="outline" onClick={() => onAnswer(opt)} disabled={disabled}>
            {opt}
          </Button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Other..."
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          className="text-sm"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && otherText.trim()) onAnswer(otherText.trim());
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => otherText.trim() && onAnswer(otherText.trim())} disabled={disabled || !otherText.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
