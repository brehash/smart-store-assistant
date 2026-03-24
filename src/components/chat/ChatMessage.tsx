import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductSlider } from "./ProductSlider";
import { OrderTable } from "./OrderTable";
import { ChatChart } from "./ChatChart";

export interface RichContent {
  type: "products" | "orders" | "chart" | "confirmation";
  data: any;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  richContent?: RichContent | null;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, richContent, isStreaming }: ChatMessageProps) {
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

        {richContent && (
          <div className="w-full max-w-[600px]">
            {richContent.type === "products" && <ProductSlider products={richContent.data} />}
            {richContent.type === "orders" && <OrderTable orders={richContent.data} />}
            {richContent.type === "chart" && <ChatChart chartData={richContent.data} />}
          </div>
        )}
      </div>
    </div>
  );
}
