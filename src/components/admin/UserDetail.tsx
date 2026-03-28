import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AdminUser } from "@/pages/Admin";

interface Props {
  user: AdminUser;
  accessToken: string;
  onBack: () => void;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageItem {
  id: string;
  role: string;
  content: string;
  created_at: string;
  conversation_id: string;
  token_usage: { total_tokens: number } | null;
}

export function UserDetail({ user, accessToken, onBack }: Props) {
  const { toast } = useToast();
  const [dailyLimit, setDailyLimit] = useState(user.limits?.daily_limit ?? 50);
  const [monthlyLimit, setMonthlyLimit] = useState(user.limits?.monthly_limit ?? 1000);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/messages`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        setConversations(data.conversations || []);
        setMessages(data.messages || []);
      }
    };
    load();
  }, [user.user_id, accessToken]);

  const saveLimits = async () => {
    setSaving(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/limits`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ daily_limit: dailyLimit, monthly_limit: monthlyLimit }),
        }
      );
      if (resp.ok) {
        toast({ title: "Limits saved" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">{user.display_name || "Unknown User"}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Messages</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{user.message_count.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Tokens</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{user.total_tokens.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Conversations</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{conversations.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Roles</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{user.roles.join(", ") || "none"}</p></CardContent>
        </Card>
      </div>

      {/* Message limits */}
      <Card>
        <CardHeader><CardTitle>Message Limits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Daily Limit</Label>
              <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Monthly Limit</Label>
              <Input type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <Button onClick={saveLimits} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save Limits
          </Button>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader><CardTitle>Recent Messages ({messages.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded border p-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-medium ${m.role === "assistant" ? "text-primary" : "text-muted-foreground"}`}>
                    {m.role}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {m.token_usage && <span className="tabular-nums">{m.token_usage.total_tokens} tokens</span>}
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
