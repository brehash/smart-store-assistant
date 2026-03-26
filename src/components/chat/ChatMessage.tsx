import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductSlider } from "./ProductSlider";
import { OrderTable } from "./OrderTable";
import { ChatChart } from "./ChatChart";
import { PipelinePlan, type PipelinePlanData } from "./PipelinePlan";
import { ApprovalCard } from "./ApprovalCard";
import { QuestionCard } from "./QuestionCard";
import { DebugPanel, type DebugEntry } from "./DebugPanel";

export interface RichContent {
  type: "products" | "orders" | "chart" | "confirmation" | "pipeline";
  data: any;
}

export interface ApprovalRequest {
  stepIndex: number;
  summary: string;
  toolName: string;
  args: any;
  toolCallId: string;
  resolved?: "approved" | "skipped" | "edited";
}

export interface QuestionRequest {
  question: string;
  options?: string[];
  resolved?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  richContents?: RichContent[];
  isStreaming?: boolean;
  pipeline?: PipelinePlanData | null;
  approvals?: ApprovalRequest[];
  questions?: QuestionRequest[];
  debugLogs?: DebugEntry[];
  onApproval?: (approval: ApprovalRequest, action: "approve" | "skip" | "edit", editedText?: string) => void;
  onQuestionAnswer?: (question: QuestionRequest, answer: string) => void;
}

export function ChatMessage({
  role, content, richContents, isStreaming,
  pipeline, approvals, questions, debugLogs,
  onApproval, onQuestionAnswer,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-4", isUser ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex max-w-[80%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
        {/* Pipeline plan */}
        {pipeline && !isUser && <PipelinePlan plan={pipeline} />}

        {/* Approval cards */}
        {approvals?.map((a, i) => (
          <ApprovalCard
            key={`approval-${i}`}
            summary={a.summary}
            resolved={a.resolved}
            onApprove={() => onApproval?.(a, "approve")}
            onSkip={() => onApproval?.(a, "skip")}
            onEdit={(text) => onApproval?.(a, "edit", text)}
            disabled={!!a.resolved || isStreaming}
          />
        ))}

        {/* Question cards */}
        {questions?.map((q, i) => (
          <QuestionCard
            key={`question-${i}`}
            question={q.question}
            options={q.options}
            resolved={q.resolved}
            onAnswer={(answer) => onQuestionAnswer?.(q, answer)}
            disabled={!!q.resolved || isStreaming}
          />
        ))}

        {/* Text content */}
        {content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border rounded-bl-md"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                <ReactMarkdown>{content}</ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-0.5" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Rich content */}
        {richContents?.map((rc, i) => (
          <div key={`rich-${i}`} className="w-full max-w-[600px]">
            {rc.type === "products" && <ProductSlider products={rc.data} />}
            {rc.type === "orders" && <OrderTable orders={rc.data} />}
            {rc.type === "chart" && <ChatChart chartData={rc.data} />}
          </div>
        ))}
      </div>
    </div>
  );
}
