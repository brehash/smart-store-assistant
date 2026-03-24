import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { streamChat } from "@/lib/chat-stream";
import { ChatMessage, type RichContent } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  richContent?: RichContent | null;
}

export default function Index() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            richContent: m.rich_content as RichContent | null,
          }))
        );
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
    if (data) {
      setConversationId(data.id);
      setMessages([]);
      return data.id;
    }
    return null;
  };

  const handleSend = async (input: string) => {
    if (!user || !session) return;

    let convId = conversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    scrollToBottom();

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: input,
    });

    // Update conversation title from first message
    if (messages.length === 0) {
      const title = input.slice(0, 60) + (input.length > 60 ? "..." : "");
      await supabase.from("conversations").update({ title }).eq("id", convId);
    }

    let assistantContent = "";
    let richContent: RichContent | null = null;

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.id) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
      scrollToBottom();
    };

    await streamChat({
      messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
      conversationId: convId,
      accessToken: session.access_token,
      onDelta: upsertAssistant,
      onToolCall: (tc) => {
        richContent = tc;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.id) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, richContent: tc } : m
            );
          }
          return prev;
        });
      },
      onDone: async () => {
        setIsStreaming(false);
        // Save assistant message
        if (assistantContent) {
          await supabase.from("messages").insert({
            conversation_id: convId!,
            user_id: user.id,
            role: "assistant",
            content: assistantContent,
            rich_content: richContent as any,
          });
        }
      },
      onError: (error) => {
        setIsStreaming(false);
        toast({ title: "Error", description: error, variant: "destructive" });
      },
    });
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ConversationSidebar
          activeId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold truncate">WooCommerce AI Assistant</h1>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
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
                {[
                  "Search for pasta products",
                  "Show me today's orders",
                  "Sales report for this week",
                  "Create a new order",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent transition-colors"
                  >
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
                  richContent={msg.richContent}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
