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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings, Globe, Palette, Store, User,
  Save, Trash2, CheckCircle2, XCircle, Key, ListChecks, Loader2,
  Sun, Moon, Monitor, Eye, EyeOff, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SettingsTab = "general" | "settings" | "appearance" | "connection" | "account";

interface OrderStatus { slug: string; name: string; total: number; }

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "settings", label: "Settings", icon: Globe },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "connection", label: "Connection", icon: Store },
  { id: "account", label: "Account", icon: User },
];

/* ------------------------------------------------------------------ */
/*  Main exported component                                            */
/* ------------------------------------------------------------------ */

export function SettingsContent({ activeTab = "general", onTabChange, onClose }: {
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  onClose?: () => void;
}) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // WooCommerce state
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

  // General tab state
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<"system" | "dark" | "light">(() => {
    return (localStorage.getItem("theme") as any) || "system";
  });

  const LANGUAGES = [
    "English", "Romanian", "French", "German", "Spanish", "Italian",
    "Portuguese", "Dutch", "Polish", "Turkish", "Greek", "Russian",
    "Chinese", "Japanese", "Korean",
  ];

  /* ---------- load data ---------- */
  useEffect(() => {
    if (!user) return;
    // Load profile
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setDisplayName(data.display_name || "");
    });
    // Load woo connection
    supabase.from("woo_connections").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle().then(({ data }) => {
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
    });
  }, [user]);

  /* ---------- helpers ---------- */
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
    } catch { /* silent */ } finally { setLoadingStatuses(false); }
  };

  const toggleStatus = (slug: string) =>
    setSelectedStatuses((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        store_url: storeUrl, consumer_key: consumerKey, consumer_secret: consumerSecret,
        store_name: storeName, response_language: responseLanguage,
        openai_api_key: openaiApiKey || null, order_statuses: selectedStatuses,
      };
      if (existingConnection) {
        await supabase.from("woo_connections").update(payload as any).eq("id", existingConnection.id);
      } else {
        const { data } = await supabase.from("woo_connections").insert({ user_id: user.id, ...payload } as any).select().single();
        setExistingConnection(data);
      }
      // Save display name
      await supabase.from("profiles").update({ display_name: displayName } as any).eq("user_id", user.id);
      toast({ title: "Saved!", description: "Settings updated successfully." });
    } catch { toast({ title: "Error", description: "Failed to save.", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { action: "test", storeUrl, consumerKey, consumerSecret },
      });
      if (error) throw error;
      setTestResult("success");
      if (data?.name) setStoreName(data.name);
      toast({ title: "Connection successful!", description: `Connected to ${data?.name || storeUrl}` });
      fetchOrderStatuses(storeUrl, consumerKey, consumerSecret);
    } catch { setTestResult("error"); toast({ title: "Connection failed", description: "Check your API keys and store URL.", variant: "destructive" }); }
    finally { setTesting(false); }
  };

  const handleDelete = async () => {
    if (!existingConnection) return;
    await supabase.from("woo_connections").delete().eq("id", existingConnection.id);
    setExistingConnection(null); setConsumerKey(""); setConsumerSecret(""); setStoreName(""); setOrderStatuses([]); setSelectedStatuses([]);
    toast({ title: "Deleted", description: "WooCommerce connection removed." });
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) { toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" }); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Password updated" }); setNewPassword(""); setConfirmPassword(""); }
    setChangingPassword(false);
  };

  const applyTheme = (t: "system" | "dark" | "light") => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  };

  const handleDeleteAccount = async () => {
    // Sign out — actual deletion would require a backend function
    await signOut();
    toast({ title: "Signed out", description: "Contact support to permanently delete your account." });
  };

  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—";

  /* ---------------------------------------------------------------- */
  /*  Section renderers                                                */
  /* ---------------------------------------------------------------- */

  const renderGeneral = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">Profile and account basics</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Registered</Label>
            <Input value={createdAt} disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={handlePasswordChange} disabled={changingPassword || !newPassword} size="sm">
            {changingPassword ? "Updating…" : "Update Password"}
          </Button>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">AI and language preferences</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Globe className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>AI Response Language</CardTitle>
              <CardDescription>Choose the language for AI responses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={responseLanguage} onValueChange={setResponseLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (<SelectItem key={lang} value={lang}>{lang}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Key className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>OpenAI API Key</CardTitle>
              <CardDescription>Optional — uses your own OpenAI key. Leave blank for default AI.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="sk-..." type="password" />
          <p className="text-xs text-muted-foreground">When set, chat requests route to OpenAI using <code className="text-xs">gpt-4o-mini</code>.</p>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );

  const renderAppearance = () => {
    const options: { value: "system" | "light" | "dark"; label: string; icon: React.ElementType; desc: string }[] = [
      { value: "system", label: "System", icon: Monitor, desc: "Follow your device settings" },
      { value: "light", label: "Light", icon: Sun, desc: "Always use light mode" },
      { value: "dark", label: "Dark", icon: Moon, desc: "Always use dark mode" },
    ];
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize how the app looks</p>
        </div>
        <div className="grid gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyTheme(opt.value)}
              className={cn(
                "flex items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                theme === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent/50"
              )}
            >
              <div className={cn(
                "rounded-lg p-2",
                theme === opt.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <opt.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderConnection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connection</h2>
        <p className="text-sm text-muted-foreground">Manage your WooCommerce store connection</p>
      </div>
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
          <div className="space-y-2"><Label>Store URL</Label><Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://yourstore.com" /></div>
          <div className="space-y-2"><Label>Consumer Key</Label><Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="ck_..." type="password" /></div>
          <div className="space-y-2"><Label>Consumer Secret</Label><Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder="cs_..." type="password" /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleTest} variant="outline" disabled={testing || !storeUrl || !consumerKey || !consumerSecret}>
              {testing ? "Testing…" : "Test Connection"}
              {testResult === "success" && <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-500" />}
              {testResult === "error" && <XCircle className="ml-1.5 h-4 w-4 text-destructive" />}
            </Button>
            <Button onClick={handleSave} disabled={saving || !storeUrl || !consumerKey || !consumerSecret} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
            {existingConnection && (
              <Button onClick={handleDelete} variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </CardContent>
      </Card>

      {orderStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Default Order Statuses</CardTitle>
                <CardDescription>Select which order statuses to include by default</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStatuses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {orderStatuses.map((status) => (
                  <label key={status.slug} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors">
                    <Checkbox checked={selectedStatuses.includes(status.slug)} onCheckedChange={() => toggleStatus(status.slug)} />
                    <span className="text-sm flex-1">{status.name}</span>
                    <span className="text-xs text-muted-foreground">{status.total}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAccount = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Account information and management</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span>{createdAt}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions — proceed with caution</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove all data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "general": return renderGeneral();
      case "settings": return renderSettings();
      case "appearance": return renderAppearance();
      case "connection": return renderConnection();
      case "account": return renderAccount();
      default: return renderGeneral();
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Layout                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full min-h-[500px]">
      {/* Sidebar nav */}
      <nav className="w-52 shrink-0 border-r border-border p-3 space-y-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              activeTab === tab.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl">
          {renderTab()}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function SettingsPage() {
  return null;
}
