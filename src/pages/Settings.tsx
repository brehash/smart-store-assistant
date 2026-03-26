import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Store, Save, Trash2, CheckCircle2, XCircle, Globe, Key, ListChecks, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrderStatus {
  slug: string;
  name: string;
  total: number;
}

export function SettingsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [storeUrl, setStoreUrl] = useState("https://kspices.ro");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [storeName, setStoreName] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("English");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  const LANGUAGES = [
    "English", "Romanian", "French", "German", "Spanish", "Italian",
    "Portuguese", "Dutch", "Polish", "Turkish", "Greek", "Russian",
    "Chinese", "Japanese", "Korean",
  ];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("woo_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) {
        setExistingConnection(data);
        setStoreUrl(data.store_url);
        setConsumerKey(data.consumer_key);
        setConsumerSecret(data.consumer_secret);
        setStoreName(data.store_name || "");
        setResponseLanguage(data.response_language || "English");
        setOpenaiApiKey(data.openai_api_key || "");
        const statuses = (data as any).order_statuses as string[] | undefined;
        if (statuses?.length) setSelectedStatuses(statuses);
        fetchOrderStatuses(data.store_url, data.consumer_key, data.consumer_secret);
      }
    };
    load();
  }, [user]);

  const fetchOrderStatuses = async (url: string, ck: string, cs: string) => {
    setLoadingStatuses(true);
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "reports/orders/totals", storeUrl: url, consumerKey: ck, consumerSecret: cs },
      });
      if (error) throw error;
      if (Array.isArray(data)) {
        setOrderStatuses(data.map((s: any) => ({ slug: s.slug, name: s.name, total: s.total })));
      }
    } catch {
      // silently fail
    } finally {
      setLoadingStatuses(false);
    }
  };

  const toggleStatus = (slug: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        store_url: storeUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        store_name: storeName,
        response_language: responseLanguage,
        openai_api_key: openaiApiKey || null,
        order_statuses: selectedStatuses,
      };
      if (existingConnection) {
        await supabase.from("woo_connections").update(payload as any).eq("id", existingConnection.id);
      } else {
        const { data } = await supabase
          .from("woo_connections")
          .insert({ user_id: user.id, ...payload } as any)
          .select()
          .single();
        setExistingConnection(data);
      }
      toast({ title: "Saved!", description: "Settings updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { action: "test", storeUrl, consumerKey, consumerSecret },
      });
      if (error) throw error;
      setTestResult("success");
      if (data?.name) setStoreName(data.name);
      toast({ title: "Connection successful!", description: `Connected to ${data?.name || storeUrl}` });
      fetchOrderStatuses(storeUrl, consumerKey, consumerSecret);
    } catch {
      setTestResult("error");
      toast({ title: "Connection failed", description: "Check your API keys and store URL.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingConnection) return;
    await supabase.from("woo_connections").delete().eq("id", existingConnection.id);
    setExistingConnection(null);
    setConsumerKey("");
    setConsumerSecret("");
    setStoreName("");
    setOrderStatuses([]);
    setSelectedStatuses([]);
    toast({ title: "Deleted", description: "WooCommerce connection removed." });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* WooCommerce Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Store className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>WooCommerce Connection</CardTitle>
              <CardDescription>Connect your WooCommerce store to enable AI management</CardDescription>
            </div>
          </div>
          {existingConnection && (
            <Badge variant="outline" className="w-fit mt-2 gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Connected{storeName ? ` — ${storeName}` : ""}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Store URL</Label>
            <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://yourstore.com" />
          </div>
          <div className="space-y-2">
            <Label>Consumer Key</Label>
            <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="ck_..." type="password" />
          </div>
          <div className="space-y-2">
            <Label>Consumer Secret</Label>
            <Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder="cs_..." type="password" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleTest} variant="outline" disabled={testing || !storeUrl || !consumerKey || !consumerSecret}>
              {testing ? "Testing..." : "Test Connection"}
              {testResult === "success" && <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-500" />}
              {testResult === "error" && <XCircle className="ml-1.5 h-4 w-4 text-destructive" />}
            </Button>
            <Button onClick={handleSave} disabled={saving || !storeUrl || !consumerKey || !consumerSecret} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
            </Button>
            {existingConnection && (
              <Button onClick={handleDelete} variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Status Filter */}
      {orderStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Default Order Statuses</CardTitle>
                <CardDescription>Select which order statuses to include by default in queries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStatuses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading statuses...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {orderStatuses.map((status) => (
                  <label key={status.slug} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors">
                    <Checkbox
                      checked={selectedStatuses.includes(status.slug)}
                      onCheckedChange={() => toggleStatus(status.slug)}
                    />
                    <span className="text-sm flex-1">{status.name}</span>
                    <span className="text-xs text-muted-foreground">{status.total}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Language */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Globe className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>AI Response Language</CardTitle>
              <CardDescription>Choose the language for AI responses and pipeline labels</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={responseLanguage} onValueChange={setResponseLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* OpenAI Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Key className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>OpenAI API Key</CardTitle>
              <CardDescription>Optional — uses your own OpenAI key with gpt-4o-mini. Leave blank to use the default AI.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="sk-..." type="password" />
          </div>
          <p className="text-xs text-muted-foreground">When set, all chat requests will be routed to OpenAI directly using model <code className="text-xs">gpt-4o-mini</code>.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !storeUrl || !consumerKey || !consumerSecret} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Saving all settings..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}

// Default export redirects to home with settings param
export default function Settings() {
  // This page is no longer used directly; redirect handled in App.tsx
  return null;
}
