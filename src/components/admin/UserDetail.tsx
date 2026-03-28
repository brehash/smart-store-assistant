import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Plus, Minus, Loader2 } from "lucide-react";
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

interface CreditBalance {
  balance: number;
  monthly_allowance: number;
  last_refill_at: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
  metadata: any;
}

export function UserDetail({ user, accessToken, onBack }: Props) {
  const { toast } = useToast();
  const [dailyLimit, setDailyLimit] = useState(user.limits?.daily_limit ?? 50);
  const [monthlyLimit, setMonthlyLimit] = useState(user.limits?.monthly_limit ?? 1000);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [savingLimits, setSavingLimits] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingCredits, setLoadingCredits] = useState(true);

  // Credit state
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [creditAdjustAmount, setCreditAdjustAmount] = useState(0);
  const [creditReason, setCreditReason] = useState("");
  const [monthlyAllowance, setMonthlyAllowance] = useState(100);
  const [savingCredits, setSavingCredits] = useState(false);
  const [savingAllowance, setSavingAllowance] = useState(false);

  const apiCall = async (url: string, options?: RequestInit) => {
    const resp = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...options?.headers },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    return data;
  };

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const data = await apiCall(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/messages`
        );
        setConversations(data.conversations || []);
        setMessages(data.messages || []);
      } catch (e: any) {
        toast({ title: "Failed to load messages", description: e.message, variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    };
    const loadCredits = async () => {
      setLoadingCredits(true);
      try {
        const data = await apiCall(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/credits`
        );
        setCreditBalance(data.balance || null);
        setCreditTransactions(data.transactions || []);
        if (data.balance?.monthly_allowance) setMonthlyAllowance(data.balance.monthly_allowance);
      } catch (e: any) {
        toast({ title: "Failed to load credits", description: e.message, variant: "destructive" });
      } finally {
        setLoadingCredits(false);
      }
    };
    load();
    loadCredits();
  }, [user.user_id, accessToken]);

  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      await apiCall(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/limits`,
        { method: "PUT", body: JSON.stringify({ daily_limit: dailyLimit, monthly_limit: monthlyLimit }) }
      );
      toast({ title: "Limits saved", description: `Daily: ${dailyLimit}, Monthly: ${monthlyLimit}` });
    } catch (e: any) {
      toast({ title: "Failed to save limits", description: e.message, variant: "destructive" });
    } finally {
      setSavingLimits(false);
    }
  };

  const adjustCredits = async () => {
    if (creditAdjustAmount === 0) return;
    setSavingCredits(true);
    try {
      const data = await apiCall(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/credits`,
        { method: "PUT", body: JSON.stringify({ amount: creditAdjustAmount, reason: creditReason || "admin_grant" }) }
      );
      setCreditBalance((prev) => prev ? { ...prev, balance: data.balance } : null);
      const action = creditAdjustAmount > 0 ? "Added" : "Deducted";
      toast({ title: `${action} ${Math.abs(creditAdjustAmount)} credits`, description: `New balance: ${data.balance}` });
      setCreditAdjustAmount(0);
      setCreditReason("");
      // Reload transactions
      const txData = await apiCall(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/credits`
      );
      setCreditTransactions(txData.transactions || []);
    } catch (e: any) {
      toast({ title: "Failed to adjust credits", description: e.message, variant: "destructive" });
    } finally {
      setSavingCredits(false);
    }
  };

  const saveAllowance = async () => {
    setSavingAllowance(true);
    try {
      await apiCall(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/allowance`,
        { method: "PUT", body: JSON.stringify({ monthly_allowance: monthlyAllowance }) }
      );
      toast({ title: "Monthly allowance updated", description: `Set to ${monthlyAllowance} credits/month` });
    } catch (e: any) {
      toast({ title: "Failed to update allowance", description: e.message, variant: "destructive" });
    } finally {
      setSavingAllowance(false);
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

      <div className="grid gap-4 md:grid-cols-5">
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
          <CardContent>
            {loadingData ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold tabular-nums">{conversations.length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Credits</CardTitle></CardHeader>
          <CardContent>
            {loadingCredits ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold tabular-nums">{creditBalance?.balance ?? "—"}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Roles</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{user.roles.join(", ") || "none"}</p></CardContent>
        </Card>
      </div>

      {/* Credit Management */}
      <Card>
        <CardHeader><CardTitle>Credit Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingCredits ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Monthly Allowance (auto-refill every 30 days)</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={monthlyAllowance} onChange={(e) => setMonthlyAllowance(parseInt(e.target.value) || 0)} />
                    <Button onClick={saveAllowance} disabled={savingAllowance} size="sm">
                      {savingAllowance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Last Refill</Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    {creditBalance?.last_refill_at ? new Date(creditBalance.last_refill_at).toLocaleDateString() : "Never"}
                  </p>
                </div>
              </div>
              <div>
                <Label>Grant / Deduct Credits</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    placeholder="Amount (positive to add, negative to deduct)"
                    value={creditAdjustAmount || ""}
                    onChange={(e) => setCreditAdjustAmount(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <Button onClick={adjustCredits} disabled={savingCredits || creditAdjustAmount === 0}>
                    {savingCredits ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : creditAdjustAmount >= 0 ? (
                      <Plus className="h-4 w-4 mr-1" />
                    ) : (
                      <Minus className="h-4 w-4 mr-1" />
                    )}
                    {savingCredits ? "Applying..." : "Apply"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Transactions */}
      {creditTransactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Credit Transactions ({creditTransactions.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {creditTransactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center rounded border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-medium ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                    <span className="text-muted-foreground">{tx.reason}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">bal: {tx.balance_after}</span>
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          <Button onClick={saveLimits} disabled={savingLimits}>
            {savingLimits ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            {savingLimits ? "Saving..." : "Save Limits"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader><CardTitle>Recent Messages ({messages.length})</CardTitle></CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
