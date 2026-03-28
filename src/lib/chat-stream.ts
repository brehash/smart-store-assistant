type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export interface PipelineEvent {
  type: "pipeline_plan" | "pipeline_step" | "pipeline_complete" | "approval_request" | "question_request" | "debug_api" | "reasoning" | "token_usage" | "credit_usage" | "order_form";
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
  prefill?: any;
  text?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  remaining_balance?: number;
}

function handleSsePayload(
  parsed: any,
  callbacks: {
    onDelta: (text: string) => void;
    onToolCall?: (toolCall: any) => void;
    onPipelineEvent?: (event: PipelineEvent) => void;
  },
) {
  if (parsed.error && typeof parsed.error === "string") {
    console.warn("SSE error from backend:", parsed.error);
    return true;
  }

  if (
    parsed.type === "pipeline_plan" ||
    parsed.type === "pipeline_step" ||
    parsed.type === "pipeline_complete" ||
    parsed.type === "approval_request" ||
    parsed.type === "question_request" ||
    parsed.type === "debug_api" ||
    parsed.type === "reasoning" ||
    parsed.type === "token_usage" ||
    parsed.type === "credit_usage" ||
    parsed.type === "order_form"
  ) {
    callbacks.onPipelineEvent?.(parsed);
    return true;
  }

  if (parsed.type === "rich_content") {
    callbacks.onToolCall?.({ type: parsed.contentType, data: parsed.data });
    return true;
  }

  if (parsed.type === "dashboard") {
    callbacks.onToolCall?.({ type: "dashboard", data: parsed.data });
    return true;
  }

  const content = parsed.choices?.[0]?.delta?.content as string | undefined;
  if (content) {
    callbacks.onDelta(content);
    return true;
  }

  return false;
}

function processSseLine(
  line: string,
  callbacks: {
    onDelta: (text: string) => void;
    onToolCall?: (toolCall: any) => void;
    onPipelineEvent?: (event: PipelineEvent) => void;
  },
): { handled: boolean; done: boolean } {
  let normalized = line;
  if (normalized.endsWith("\r")) normalized = normalized.slice(0, -1);
  if (normalized.startsWith(":") || normalized.trim() === "") return { handled: false, done: false };
  if (!normalized.startsWith("data: ")) return { handled: false, done: false };

  const jsonStr = normalized.slice(6).trim();
  if (jsonStr === "[DONE]") return { handled: true, done: true };

  try {
    const parsed = JSON.parse(jsonStr);
    return { handled: handleSsePayload(parsed, callbacks), done: false };
  } catch {
    return { handled: false, done: false };
  }
}

function flushRemainingBuffer(
  buffer: string,
  callbacks: {
    onDelta: (text: string) => void;
    onToolCall?: (toolCall: any) => void;
    onPipelineEvent?: (event: PipelineEvent) => void;
  },
) {
  for (const raw of buffer.split("\n")) {
    if (!raw.trim()) continue;
    processSseLine(raw, callbacks);
  }
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
  viewId,
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
  viewId?: string | null;
}) {
  let receivedPayload = false;
  const callbacks = {
    onDelta: (text: string) => {
      receivedPayload = true;
      onDelta(text);
    },
    onToolCall: (toolCall: any) => {
      receivedPayload = true;
      onToolCall?.(toolCall);
    },
    onPipelineEvent: (event: PipelineEvent) => {
      receivedPayload = true;
      onPipelineEvent?.(event);
    },
  };

  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, conversationId, approvalResponse, viewId }),
    });

    if (resp.status === 429) { onError("Rate limited — please wait a moment and try again."); return; }
    if (resp.status === 402) { onError("AI credits exhausted."); return; }
    if (!resp.ok || !resp.body) { onError(await resp.text() || "Failed to connect to AI"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;
    let lastActivity = Date.now();
    const INACTIVITY_TIMEOUT = 120_000;

    while (!streamDone) {
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        reader.cancel();
        onError("Connection timed out — no data received for 2 minutes. Please try again.");
        return;
      }

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (readError) {
        flushRemainingBuffer(buffer, callbacks);
        if (receivedPayload) {
          onDone();
          return;
        }
        throw readError;
      }

      const { done, value } = readResult;
      if (done) break;

      lastActivity = Date.now();
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        const result = processSseLine(line, callbacks);
        if (result.done) {
          streamDone = true;
          break;
        }

        if (!result.handled && line.startsWith("data: ")) {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    if (buffer.trim()) {
      flushRemainingBuffer(buffer, callbacks);
    }

    onDone();
  } catch (e) {
    if (receivedPayload) {
      onDone();
      return;
    }
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
