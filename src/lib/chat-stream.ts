type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export interface PipelineEvent {
  type: "pipeline_plan" | "pipeline_step" | "pipeline_complete" | "approval_request" | "question_request" | "debug_api";
  title?: string;
  steps?: string[];
  stepIndex?: number;
  status?: string;
  toolName?: string;
  args?: any;
  summary?: string;
  details?: string;
  lastStepIndex?: number;
  question?: string;
  options?: string[];
  toolCallId?: string;
  result?: any;
  requestUri?: string;
}

export async function streamChat({
  messages,
  conversationId,
  onDelta,
  onToolCall,
  onPipelineEvent,
  onDone,
  onError,
  accessToken,
  approvalResponse,
}: {
  messages: Msg[];
  conversationId: string;
  onDelta: (text: string) => void;
  onToolCall?: (toolCall: any) => void;
  onPipelineEvent?: (event: PipelineEvent) => void;
  onDone: () => void;
  onError: (error: string) => void;
  accessToken: string;
  approvalResponse?: { toolCallId: string; action: "approve" | "skip" | "edit"; editedArgs?: string };
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, conversationId, approvalResponse }),
    });

    if (resp.status === 429) { onError("Rate limited — please wait a moment and try again."); return; }
    if (resp.status === 402) { onError("AI credits exhausted."); return; }
    if (!resp.ok || !resp.body) { onError(await resp.text() || "Failed to connect to AI"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);

          // Pipeline events
          if (parsed.type === "pipeline_plan" || parsed.type === "pipeline_step" || parsed.type === "pipeline_complete" || parsed.type === "approval_request" || parsed.type === "question_request" || parsed.type === "debug_api") {
            onPipelineEvent?.(parsed);
            continue;
          }

          // Rich content (products, orders, charts)
          if (parsed.type === "rich_content") {
            onToolCall?.(parsed);
            continue;
          }

          // Dashboard content
          if (parsed.type === "dashboard") {
            onToolCall?.({ type: "dashboard", data: parsed.data });
            continue;
          }

          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
