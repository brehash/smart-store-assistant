import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { streamChat, type PipelineEvent } from "@/lib/chat-stream";
import { ChatMessage, type RichContent, type ApprovalRequest, type QuestionRequest } from "@/components/chat/ChatMessage";
import type { OrderFormData } from "@/components/chat/OrderFormCard";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ConnectionSetupCard } from "@/components/chat/ConnectionSetupCard";
import { WebhookSetupCard } from "@/components/chat/WebhookSetupCard";
import { SettingsContent, type SettingsTab } from "@/pages/Settings";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchParams, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PipelinePlanData } from "@/components/chat/PipelinePlan";
import type { PipelineStepData } from "@/components/chat/PipelineStep";
import type { DebugEntry } from "@/components/chat/DebugPanel";
import type { ReasoningEntry } from "@/components/chat/ReasoningBubbles";
import { CreditsModal } from "@/components/chat/CreditsModal";

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface CreditUsage {
  cost: number;
  remaining_balance: number;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  richContents?: RichContent[];
  pipeline?: PipelinePlanData | null;
  approvals?: ApprovalRequest[];
  questions?: QuestionRequest[];
  orderForms?: OrderFormData[];
  debugLogs?: DebugEntry[];
  reasoningLogs?: ReasoningEntry[];
  tokenUsage?: TokenUsage;
  creditUsage?: CreditUsage;
}

export default function Index() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsParam = searchParams.get("settings");
  const [settingsOpen, setSettingsOpen] = useState(() => !!settingsParam);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => (settingsParam as SettingsTab) || "general");
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAliveRef = useRef(false);
  const skipLoadRef = useRef(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [topupModalEnabled, setTopupModalEnabled] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [hasConnection, setHasConnection] = useState<boolean | null>(null); // null = loading
  const [showWebhookSetup, setShowWebhookSetup] = useState(false);
  const [cachedPaymentMethods, setCachedPaymentMethods] = useState<{ id: string; title: string }[]>([]);
  const [cachedAllStatuses, setCachedAllStatuses] = useState<{ slug: string; name: string }[]>([]);
  const [cachedSelectedStatuses, setCachedSelectedStatuses] = useState<string[]>([]);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);

  // Fetch credit balance and app settings on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("refill_credits_if_due", { _user_id: user.id });
      if (data) {
        setCreditBalance(data.balance);
        setCurrentPlanId((data as any).plan_id || null);
      }
      const { data: settings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "enable_topup_modal")
        .maybeSingle();
      if (settings) setTopupModalEnabled(settings.value === true || settings.value === "true");
    })();
  }, [user]);

  // Check if user has a WooCommerce connection (or team owner does) + fetch cached data
  useEffect(() => {
    if (!user) return;
    const checkConnection = async () => {
      // First check own connection
      const { data: ownConn } = await supabase
        .from("woo_connections")
        .select("id, order_statuses")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (ownConn) {
        setHasConnection(true);
        setCachedSelectedStatuses((ownConn as any).order_statuses || []);
        // Check if webhooks already exist on the store before showing setup card
        try {
          const { data: whData } = await supabase.functions.invoke("woo-proxy", {
            body: { endpoint: "webhooks", method: "GET" },
          });
          const hasWebhooks = Array.isArray(whData) && whData.some(
            (w: any) => w.name?.startsWith("Lovable") && w.status === "active"
          );
          if (!hasWebhooks) {
            const dismissed = localStorage.getItem(`webhook-setup-dismissed-${user.id}`);
            if (!dismissed) setShowWebhookSetup(true);
          }
        } catch {
          // If webhook check fails, fall back to localStorage
          const dismissed = localStorage.getItem(`webhook-setup-dismissed-${user.id}`);
          if (!dismissed) setShowWebhookSetup(true);
        }
        return;
      }

      // No own connection — check if user is in a team (team owner has the connection)
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (membership) {
        setHasConnection(true);
      } else {
        setHasConnection(false);
        // Retry once after a short delay in case invite acceptance is still in-flight
        setTimeout(async () => {
          const { data: retryMembership } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (retryMembership) setHasConnection(true);
        }, 2000);
      }
    };
    checkConnection();
    // Fetch cached payment methods and order statuses
    supabase
      .from("woo_cache" as any)
      .select("cache_key, data")
      .eq("user_id", user.id)
      .in("cache_key", ["payment_methods", "order_statuses", "products"])
      .then(({ data }: any) => {
        if (Array.isArray(data)) {
          for (const row of data) {
            if (row.cache_key === "payment_methods") setCachedPaymentMethods(row.data || []);
            if (row.cache_key === "order_statuses") setCachedAllStatuses(row.data || []);
            if (row.cache_key === "products") setCachedProducts(row.data || []);
          }
        }
      });
  }, [user]);

  // Realtime webhook event notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("webhook-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "webhook_events", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const { topic, payload: eventData } = payload.new;
          // Ignore ping/unknown/action events
          if (!topic || topic === "unknown" || topic.startsWith("action.")) return;
          let title = "Eveniment Webhook";
          let description = topic;
          if (topic === "order.created" && eventData) {
            const num = eventData.number || eventData.id;
            const total = eventData.total || "—";
            const name = eventData.billing?.first_name
              ? `${eventData.billing.first_name} ${eventData.billing.last_name || ""}`
              : "";
            title = "🛒 Comandă nouă";
            description = `Comanda #${num} — ${total}${name ? ` de la ${name}` : ""}`;
          } else if (topic === "customer.created" && eventData) {
            title = "👤 Client nou";
            description = eventData.email || `${eventData.first_name || ""} ${eventData.last_name || ""}`;
          } else if (topic === "order.updated" && eventData) {
            const num = eventData.number || eventData.id;
            title = "📦 Comandă actualizată";
            description = `Comanda #${num} status: ${eventData.status || "necunoscut"}`;
          }
          toast({ title, description });
          // Increment new order count for package slips badge
          if (topic === "order.created") {
            setNewOrderCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  // Reset new order count when navigating to package slips
  useEffect(() => {
    if (location.pathname === "/package-slips") {
      setNewOrderCount(0);
    }
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    if (isMobile) return; // Prevent collapse on mobile
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleOpenSettings = () => {
    setSidebarOpen(false);
    setSettingsOpen(true);
    setSettingsTab("general");
    setSearchParams({ settings: "general" }, { replace: true });
  };

  const handleCloseSettings = (open: boolean) => {
    setSettingsOpen(open);
    if (!open) {
      searchParams.delete("settings");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleSettingsTabChange = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setSearchParams({ settings: tab }, { replace: true });
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Detect dead streams when tab regains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isStreaming && !streamAliveRef.current) {
        // Stream likely died while tab was backgrounded — give it 5s grace period
        const checkTimeout = setTimeout(() => {
          if (isStreaming && !streamAliveRef.current) {
            setIsStreaming(false);
            toast({
              title: "Connection lost",
              description: "The stream was interrupted while the tab was in the background. Your partial response has been saved.",
              variant: "destructive",
            });
          }
        }, 5000);
        return () => clearTimeout(checkTimeout);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isStreaming, toast]);

  useEffect(() => {
    if (!conversationId || !user) return;
    if (skipLoadRef.current) { skipLoadRef.current = false; return; }
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((m) => {
          const meta = (m as any).metadata as any;
          // Normalize rich_content: could be a single object or an array
          let richContents: RichContent[] = [];
          if (m.rich_content) {
            if (Array.isArray(m.rich_content)) {
              richContents = m.rich_content as unknown as RichContent[];
            } else {
              richContents = [m.rich_content as unknown as RichContent];
            }
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            richContents,
            pipeline: meta?.pipeline || null,
            debugLogs: meta?.debugLogs || [],
            approvals: meta?.approvals || [],
            questions: meta?.questions || [],
            orderForms: meta?.orderForms || [],
            reasoningLogs: meta?.reasoningLogs || [],
            tokenUsage: (m as any).token_usage || undefined,
          };
        }));
        scrollToBottom();
      }
    };
    load();
  }, [conversationId, user, scrollToBottom]);

  const createConversation = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select()
      .single();
    if (data) { skipLoadRef.current = true; setConversationId(data.id); setMessages([]); return data.id; }
    return null;
  };

  const updateLastAssistant = (updater: (msg: Message) => Message) => {
    setMessages((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      const last = prev[lastIdx];
      if (last.role === "assistant" && !last.id) {
        return prev.map((m, i) => i === lastIdx ? updater(m) : m);
      }
      // Create a new assistant message
      return [...prev, updater({ role: "assistant", content: "" })];
    });
  };

  const handleSend = async (input: string) => {
    if (!user || !session || isStreaming) return;

    let convId = conversationId;
    if (!convId) { convId = await createConversation(); if (!convId) return; }

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    streamAliveRef.current = true;
    scrollToBottom();

    const { error: userMsgError } = await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: input });
    if (userMsgError) {
      console.error("Failed to save user message:", userMsgError);
      toast({ title: "Warning", description: "Your message may not be saved. Please check your connection.", variant: "destructive" });
    }

    if (messages.length === 0) {
      const title = input.slice(0, 60) + (input.length > 60 ? "..." : "");
      await supabase.from("conversations").update({ title }).eq("id", convId);
    }

    let assistantContent = "";
    let richContents: RichContent[] = [];
    let pipelineData: PipelinePlanData | null = null;
    let debugEntries: DebugEntry[] = [];
    let approvalsList: ApprovalRequest[] = [];
    let questionsList: QuestionRequest[] = [];
    let orderFormsList: OrderFormData[] = [];
    let reasoningEntries: ReasoningEntry[] = [];
    let tokenUsage: TokenUsage | null = null;
    let creditUsage: CreditUsage | null = null;
    await streamChat({
      messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
      conversationId: convId,
      accessToken: session.access_token,
      viewId,
      onDelta: (chunk) => {
        assistantContent += chunk;
        streamAliveRef.current = true;
        updateLastAssistant((m) => ({ ...m, content: assistantContent }));
        scrollToBottom();
      },
      onToolCall: (tc) => {
        richContents = [...richContents, tc];
        updateLastAssistant((m) => ({ ...m, richContents: [...(m.richContents || []), tc] }));
      },
      onPipelineEvent: (event: PipelineEvent) => {
        if (event.type === "pipeline_plan") {
          const existingSteps = pipelineData?.steps || [];
          const planSteps: PipelineStepData[] = (event.steps || []).map((s, i) => ({
            id: `step-${i}`,
            title: s,
            status: existingSteps[i]?.status === "done" ? "done" as const : "pending" as const,
          }));
          pipelineData = { title: event.title || "Plan", steps: planSteps };
          updateLastAssistant((m) => ({ ...m, pipeline: pipelineData }));
          scrollToBottom();
        } else if (event.type === "pipeline_step") {
          // Update pipelineData OUTSIDE the React updater to avoid batching race
          const pipeline = pipelineData || { title: "Execution Plan", steps: [] };
          const steps = [...pipeline.steps];
          if (event.stepIndex !== undefined) {
            while (steps.length <= event.stepIndex) {
              steps.push({ id: `step-${steps.length}`, title: "...", status: "pending" as const });
            }
            steps[event.stepIndex] = {
              ...steps[event.stepIndex],
              title: event.title || steps[event.stepIndex].title,
              status: (event.status as PipelineStepData["status"]) || "running",
              details: event.details,
            };
          }
          pipelineData = { ...pipeline, steps };
          updateLastAssistant((m) => ({ ...m, pipeline: pipelineData }));
          scrollToBottom();
        } else if (event.type === "approval_request") {
          const approval: ApprovalRequest = {
            stepIndex: event.stepIndex || 0,
            summary: event.summary || "",
            toolName: event.toolName || "",
            args: event.args,
            toolCallId: event.toolCallId || "",
          };
          approvalsList = [...approvalsList, approval];
          updateLastAssistant((m) => ({
            ...m,
            approvals: [...(m.approvals || []), approval],
          }));
          scrollToBottom();
        } else if (event.type === "pipeline_complete") {
          // Update pipelineData OUTSIDE the React updater to avoid batching race
          if (pipelineData) {
            const doneSteps = pipelineData.steps.map((s) =>
              s.status === "pending" ? { ...s, status: "done" as const } : s
            );
            pipelineData = { ...pipelineData, steps: doneSteps };
          }
          updateLastAssistant((m) => {
            if (!m.pipeline) return m;
            return { ...m, pipeline: pipelineData! };
          });
          scrollToBottom();
        } else if (event.type === "order_form") {
          const orderForm: OrderFormData = {
            toolCallId: event.toolCallId || "",
            stepIndex: event.stepIndex || 0,
            prefill: event.prefill,
          };
          orderFormsList = [...orderFormsList, orderForm];
          updateLastAssistant((m) => ({
            ...m,
            orderForms: [...(m.orderForms || []), orderForm],
          }));
          scrollToBottom();
        } else if (event.type === "question_request") {
          const question: QuestionRequest = {
            question: event.question || "",
            options: event.options,
          };
          questionsList = [...questionsList, question];
          updateLastAssistant((m) => ({
            ...m,
            questions: [...(m.questions || []), question],
          }));
          scrollToBottom();
        } else if (event.type === "debug_api") {
          const entry: DebugEntry = {
            toolName: event.toolName || "",
            args: event.args,
            result: event.result,
            requestUri: event.requestUri,
          };
          debugEntries = [...debugEntries, entry];
          updateLastAssistant((m) => ({
            ...m,
            debugLogs: [...(m.debugLogs || []), entry],
          }));
        } else if (event.type === "reasoning") {
          const rEntry: ReasoningEntry = {
            text: event.text || "",
            timestamp: Date.now(),
          };
          reasoningEntries = [...reasoningEntries, rEntry];
          updateLastAssistant((m) => ({
            ...m,
            reasoningLogs: [...(m.reasoningLogs || []), rEntry],
          }));
          scrollToBottom();
        } else if (event.type === "token_usage") {
          tokenUsage = {
            prompt_tokens: event.prompt_tokens || 0,
            completion_tokens: event.completion_tokens || 0,
            total_tokens: event.total_tokens || 0,
          };
          updateLastAssistant((m) => ({ ...m, tokenUsage: tokenUsage! }));
        } else if (event.type === "credit_usage") {
          creditUsage = {
            cost: event.cost || 0,
            remaining_balance: event.remaining_balance || 0,
          };
          setCreditBalance(creditUsage.remaining_balance);
          updateLastAssistant((m) => ({ ...m, creditUsage: creditUsage! }));
        }
      },
      onDone: async () => {
        setIsStreaming(false);
        streamAliveRef.current = false;
        const metadata: any = {};
        if (pipelineData) metadata.pipeline = pipelineData;
        if (debugEntries.length) metadata.debugLogs = debugEntries;
        if (approvalsList.length) metadata.approvals = approvalsList;
        if (questionsList.length) metadata.questions = questionsList;
        if (orderFormsList.length) metadata.orderForms = orderFormsList;
        if (reasoningEntries.length) metadata.reasoningLogs = reasoningEntries;
        const { error: assistantMsgError } = await supabase.from("messages").insert({
          conversation_id: convId!,
          user_id: user.id,
          role: "assistant",
          content: assistantContent,
          rich_content: richContents.length ? richContents as any : null,
          metadata: Object.keys(metadata).length ? metadata : null,
          token_usage: tokenUsage,
        } as any);
        if (assistantMsgError) {
          console.error("Failed to save assistant message:", assistantMsgError);
          toast({ title: "Warning", description: "AI response may not be saved. Please check your connection.", variant: "destructive" });
        }
      },
      onError: async (error) => {
        setIsStreaming(false);
        streamAliveRef.current = false;
        toast({ title: "Error", description: error, variant: "destructive" });
        // Persist the partial assistant message so it doesn't vanish
        if (assistantContent || reasoningEntries.length || pipelineData) {
          const errorContent = assistantContent || `⚠️ ${error}`;
          const metadata: any = {};
          if (pipelineData) metadata.pipeline = pipelineData;
          if (debugEntries.length) metadata.debugLogs = debugEntries;
          if (reasoningEntries.length) metadata.reasoningLogs = reasoningEntries;
          updateLastAssistant((m) => ({ ...m, content: errorContent }));
          await supabase.from("messages").insert({
            conversation_id: convId!,
            user_id: user.id,
            role: "assistant",
            content: errorContent,
            metadata: Object.keys(metadata).length ? metadata : null,
          } as any);
        }
      },
    });
  };

  // Helper: persist resolved state of approvals/questions/orderForms to DB
  const persistMessageMetadata = async (messageId: string | undefined, updatedMsg: Message) => {
    if (!messageId) return;
    const metadata: any = {};
    if (updatedMsg.approvals?.length) metadata.approvals = updatedMsg.approvals;
    if (updatedMsg.questions?.length) metadata.questions = updatedMsg.questions;
    if (updatedMsg.orderForms?.length) metadata.orderForms = updatedMsg.orderForms;
    if (updatedMsg.pipeline) metadata.pipeline = updatedMsg.pipeline;
    if (updatedMsg.debugLogs?.length) metadata.debugLogs = updatedMsg.debugLogs;
    if (updatedMsg.reasoningLogs?.length) metadata.reasoningLogs = updatedMsg.reasoningLogs;
    await supabase.from("messages").update({ metadata }).eq("id", messageId);
  };



  const handleApproval = async (approval: ApprovalRequest, action: "approve" | "skip" | "edit", editedText?: string) => {
    if (!session || !conversationId) return;

    const resolvedValue = action === "edit" ? "edited" as const : action === "approve" ? "approved" as const : "skipped" as const;

    // Find and update the message containing this approval
    let targetMsg: Message | undefined;
    setMessages((prev) => prev.map((m) => {
      if (m.approvals?.some((a) => a.toolCallId === approval.toolCallId)) {
        const updated = {
          ...m,
          approvals: m.approvals?.map((a) =>
            a.toolCallId === approval.toolCallId ? { ...a, resolved: resolvedValue } : a
          ),
        };
        if (action === "skip" && m.pipeline) {
          const steps = m.pipeline.steps.map((s, i) =>
            i === approval.stepIndex ? { ...s, status: "skipped" as const } : s
          );
          updated.pipeline = { ...m.pipeline, steps };
        }
        targetMsg = updated;
        return updated;
      }
      return m;
    }));

    // Persist to DB
    if (targetMsg) {
      persistMessageMetadata(targetMsg.id, targetMsg);
    }

    if (action === "skip") {
      return;
    }

    // For approve/edit, send the approval response back to continue the pipeline
    setIsStreaming(true);
    let assistantContent = "";

    const approvalMsg = action === "approve"
      ? `User approved: ${approval.summary}`
      : `User edited and approved: ${editedText}`;

    await streamChat({
      messages: [...messages, { role: "user" as const, content: approvalMsg }],
      conversationId,
      accessToken: session.access_token,
      approvalResponse: { toolCallId: approval.toolCallId, action, editedArgs: editedText },
      onDelta: (chunk) => {
        assistantContent += chunk;
        updateLastAssistant((m) => ({ ...m, content: assistantContent }));
        scrollToBottom();
      },
      onToolCall: (tc) => {
        updateLastAssistant((m) => ({ ...m, richContents: [...(m.richContents || []), tc] }));
      },
      onPipelineEvent: (event: PipelineEvent) => {
        if (event.type === "pipeline_step") {
          updateLastAssistant((m) => {
            if (!m.pipeline) return m;
            const steps = [...m.pipeline.steps];
            if (event.stepIndex !== undefined && event.stepIndex < steps.length) {
              steps[event.stepIndex] = {
                ...steps[event.stepIndex],
                title: event.title || steps[event.stepIndex].title,
                status: (event.status as PipelineStepData["status"]) || "running",
                details: event.details,
              };
            }
            return { ...m, pipeline: { ...m.pipeline, steps } };
          });
          scrollToBottom();
        } else if (event.type === "pipeline_complete") {
          updateLastAssistant((m) => {
            if (!m.pipeline) return m;
            const steps = m.pipeline.steps.map((s) =>
              s.status === "pending" ? { ...s, status: "done" as const } : s
            );
            return { ...m, pipeline: { ...m.pipeline, steps } };
          });
          scrollToBottom();
        }
      },
      onDone: async () => {
        setIsStreaming(false);
        if (assistantContent) {
          await supabase.from("messages").insert({
            conversation_id: conversationId!,
            user_id: user!.id,
            role: "assistant",
            content: assistantContent,
          });
        }
      },
      onError: (error) => {
        setIsStreaming(false);
        toast({ title: "Error", description: error, variant: "destructive" });
      },
    });
  };

  const handleQuestionAnswer = async (question: QuestionRequest, answer: string) => {
    if (!session || !conversationId) return;

    let targetMsg: Message | undefined;
    setMessages((prev) => prev.map((m) => {
      if (m.questions?.some((q) => q.question === question.question)) {
        const updated = {
          ...m,
          questions: m.questions?.map((q) =>
            q.question === question.question ? { ...q, resolved: answer } : q
          ),
        };
        targetMsg = updated;
        return updated;
      }
      return m;
    }));

    if (targetMsg) {
      persistMessageMetadata(targetMsg.id, targetMsg);
    }

    // Send the answer as a new user message
    await handleSend(answer);
  };

  const handleOrderCreated = (formData: OrderFormData, result: { orderNumber: string; orderId: number; total: string }) => {
    let targetMsg: Message | undefined;
    setMessages((prev) => prev.map((m) => {
      if (m.orderForms?.some((of) => of.toolCallId === formData.toolCallId)) {
        const updated = {
          ...m,
          orderForms: m.orderForms?.map((of) =>
            of.toolCallId === formData.toolCallId ? { ...of, resolved: result } : of
          ),
        };
        targetMsg = updated;
        return updated;
      }
      return m;
    }));

    if (targetMsg) {
      persistMessageMetadata(targetMsg.id, targetMsg);
    }
  };

  const handleNewChat = () => { setConversationId(null); setMessages([]); setViewId(null); setSidebarOpen(false); };
  const handleSelectConversation = (id: string, vId?: string | null) => {
    setConversationId(id);
    setViewId(vId || null);
    setSidebarOpen(false);
  };
  const handleNewInView = async (targetViewId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New Conversation", view_id: targetViewId })
      .select()
      .single();
    if (data) {
      setConversationId(data.id);
      setViewId(targetViewId);
      setMessages([]);
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-[35] bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-[40] transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <ConversationSidebar
          activeId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onNewInView={handleNewInView}
          onViewIdChange={setViewId}
          collapsed={isMobile ? false : sidebarCollapsed}
          onToggle={handleToggleSidebar}
          onOpenSettings={handleOpenSettings}
          newOrderCount={newOrderCount}
        />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-card">
          <Button variant="ghost" size="icon" className="relative lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
            {newOrderCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {newOrderCount > 9 ? "9+" : newOrderCount}
              </span>
            )}
          </Button>
          <h1 className="text-lg font-semibold truncate">WooCommerce AI Assistant</h1>
          {creditBalance !== null && (
            <button
              onClick={() => topupModalEnabled && setCreditsModalOpen(true)}
              className={`ml-auto text-xs font-medium text-muted-foreground tabular-nums bg-muted px-2 py-1 rounded-full ${topupModalEnabled ? "hover:bg-accent cursor-pointer" : ""} transition-colors`}
            >
              {creditBalance} credit{creditBalance !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {hasConnection === false && messages.length === 0 ? (
            <ConnectionSetupCard onComplete={() => {
              setHasConnection(true);
              setShowWebhookSetup(true);
            }} />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              {showWebhookSetup && (
                <div className="w-full mb-6">
                  <WebhookSetupCard
                    onComplete={() => {
                      setShowWebhookSetup(false);
                      localStorage.setItem(`webhook-setup-dismissed-${user?.id}`, "true");
                    }}
                    onDismiss={() => {
                      setShowWebhookSetup(false);
                      localStorage.setItem(`webhook-setup-dismissed-${user?.id}`, "true");
                    }}
                  />
                </div>
              )}
              <div className="rounded-2xl bg-primary/10 p-4 mb-4">
                <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">How can I help you?</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Search products, create orders, get analytics, or ask anything about your WooCommerce store.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["Search for pasta products", "Show me today's orders", "Sales report for this week", "Create a new order"].map((s) => (
                  <button key={s} onClick={() => handleSend(s)} className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl py-4">
              {messages.map((msg, i) => (
                 <ChatMessage
                   key={i}
                   role={msg.role}
                   content={msg.content}
                   richContents={msg.richContents}
                   isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                   pipeline={msg.pipeline}
                   approvals={msg.approvals}
                   questions={msg.questions}
                   orderForms={msg.orderForms}
                   debugLogs={msg.debugLogs}
                   reasoningLogs={msg.reasoningLogs}
                   tokenUsage={msg.tokenUsage}
                   creditUsage={msg.creditUsage}
                   orderStatuses={cachedSelectedStatuses}
                   allOrderStatuses={cachedAllStatuses}
                   paymentMethods={cachedPaymentMethods}
                   cachedProducts={cachedProducts}
                   onApproval={handleApproval}
                   onQuestionAnswer={handleQuestionAnswer}
                   onOrderCreated={handleOrderCreated}
                 />
              ))}
            </div>
          )}
        </div>

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={handleCloseSettings}>
        <DialogContent className="max-w-4xl h-[85vh] overflow-hidden p-0 [&>button.absolute]:hidden z-[50]">
          <SettingsContent activeTab={settingsTab} onTabChange={handleSettingsTabChange} onClose={() => handleCloseSettings(false)} />
        </DialogContent>
      </Dialog>

      {/* Credits Modal */}
      <CreditsModal
        open={creditsModalOpen}
        onOpenChange={setCreditsModalOpen}
        currentBalance={creditBalance}
        currentPlanId={currentPlanId}
      />
    </div>
  );
}
