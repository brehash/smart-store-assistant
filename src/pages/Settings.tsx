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
import { Switch } from "@/components/ui/switch";
import {
  Settings, Globe, Palette, Store, User, Coins, Plug, Users,
  Save, Trash2, CheckCircle2, XCircle, ListChecks, Loader2,
  Sun, Moon, Monitor, X, RefreshCw, Package, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamSettings } from "@/components/settings/TeamSettings";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SettingsTab = "general" | "appearance" | "connection" | "integrations" | "team" | "credits" | "account";

interface OrderStatus { slug: string; name: string; total: number; }

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Aspect", icon: Palette },
  { id: "connection", label: "Conexiune", icon: Store },
  { id: "integrations", label: "Integrări", icon: Plug },
  { id: "team", label: "Echipă", icon: Users },
  { id: "credits", label: "Credite", icon: Coins },
  { id: "account", label: "Cont", icon: User },
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
  
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // Plugins state
  const [plugins, setPlugins] = useState<{ plugin: string; name: string; version: string }[]>([]);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);

  // General tab state
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Credits tab state
  const [creditBalance, setCreditBalance] = useState<any>(null);
  const [topupPacks, setTopupPacks] = useState<any[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);


  // Integrations state
  const [coleteOnlineEnabled, setColeteOnlineEnabled] = useState(false);
  const [coleteClientId, setColeteClientId] = useState("");
  const [coleteClientSecret, setColeteClientSecret] = useState("");
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingColete, setTestingColete] = useState(false);
  const [coleteTestResult, setColeteTestResult] = useState<"success" | "error" | null>(null);
  const [integrationLoaded, setIntegrationLoaded] = useState(false);
  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showColeteSecret, setShowColeteSecret] = useState(false);

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
        const statuses = (data as any).order_statuses as string[] | undefined;
        if (statuses?.length) setSelectedStatuses(statuses);
        const ap = (data as any).active_plugins as string[] | undefined;
        if (ap?.length) setSelectedPlugins(ap);
        fetchOrderStatuses(data.store_url, data.consumer_key, data.consumer_secret);
        fetchPlugins(data.store_url, data.consumer_key, data.consumer_secret);
      }
    });
    // Load integrations
    supabase.from("woo_integrations").select("*").eq("user_id", user.id).eq("integration_key", "colete_online").maybeSingle().then(({ data }) => {
      if (data) {
        setColeteOnlineEnabled(data.is_enabled);
        const cfg = (data.config as any) || {};
        setColeteClientId(cfg.client_id || "");
        setColeteClientSecret(cfg.client_secret || "");
      }
      setIntegrationLoaded(true);
    });
    // Load credits
    const loadCredits = async () => {
      setLoadingCredits(true);
      try {
        const [balRes, packsRes] = await Promise.all([
          supabase.from("credit_balances").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("credit_topup_packs" as any).select("*").eq("is_active", true).order("sort_order"),
        ]);
        setCreditBalance(balRes.data);
        setTopupPacks((packsRes.data as any[]) || []);
      } catch { /* silent */ }
      finally { setLoadingCredits(false); }
    };
    loadCredits();
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

  const fetchPlugins = async (url: string, ck: string, cs: string) => {
    setLoadingPlugins(true);
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "system_status", storeUrl: url, consumerKey: ck, consumerSecret: cs },
      });
      if (error) throw error;
      if (data?.active_plugins && Array.isArray(data.active_plugins)) {
        setPlugins(data.active_plugins.map((p: any) => ({ plugin: p.plugin, name: p.name, version: p.version })));
      }
    } catch { /* silent — endpoint may require higher permissions */ }
    finally { setLoadingPlugins(false); }
  };

  const toggleStatus = (slug: string) =>
    setSelectedStatuses((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);

  const togglePlugin = (slug: string) =>
    setSelectedPlugins((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        store_url: storeUrl, consumer_key: consumerKey, consumer_secret: consumerSecret,
        store_name: storeName, response_language: responseLanguage,
        order_statuses: selectedStatuses,
        active_plugins: selectedPlugins,
      };
      if (existingConnection) {
        await supabase.from("woo_connections").update(payload as any).eq("id", existingConnection.id);
      } else {
        const { data } = await supabase.from("woo_connections").insert({ user_id: user.id, ...payload } as any).select().single();
        setExistingConnection(data);
      }
      // Save display name
      await supabase.from("profiles").update({ display_name: displayName } as any).eq("user_id", user.id);
      toast({ title: "Salvat!", description: "Setările au fost actualizate cu succes." });
    } catch { toast({ title: "Eroare", description: "Salvarea a eșuat.", variant: "destructive" }); }
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
      toast({ title: "Conexiune reușită!", description: `Conectat la ${data?.name || storeUrl}` });
      fetchOrderStatuses(storeUrl, consumerKey, consumerSecret);
      fetchPlugins(storeUrl, consumerKey, consumerSecret);
    } catch { setTestResult("error"); toast({ title: "Conexiune eșuată", description: "Verifică cheile API și URL-ul magazinului.", variant: "destructive" }); }
    finally { setTesting(false); }
  };

  const refreshCache = async (url?: string, ck?: string, cs?: string) => {
    if (!user) return;
    const su = url || storeUrl;
    const key = ck || consumerKey;
    const sec = cs || consumerSecret;
    if (!su || !key || !sec) return;
    setRefreshingCache(true);
    try {
      // Fetch products (all pages)
      let allProducts: any[] = [];
      let page = 1;
      while (true) {
        const { data: products } = await supabase.functions.invoke("woo-proxy", {
          body: { endpoint: `products?per_page=100&page=${page}`, storeUrl: su, consumerKey: key, consumerSecret: sec },
        });
        if (!Array.isArray(products) || products.length === 0) break;
        allProducts = [...allProducts, ...products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, regular_price: p.regular_price, stock_status: p.stock_status, images: p.images?.slice(0, 1) }))];
        if (products.length < 100) break;
        page++;
      }
      // Fetch payment gateways
      const { data: gateways } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "payment_gateways", storeUrl: su, consumerKey: key, consumerSecret: sec },
      });
      const paymentMethods = Array.isArray(gateways)
        ? gateways.filter((g: any) => g.enabled).map((g: any) => ({ id: g.id, title: g.title }))
        : [];
      // Fetch order statuses
      const { data: statuses } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "reports/orders/totals", storeUrl: su, consumerKey: key, consumerSecret: sec },
      });
      const allStatuses = Array.isArray(statuses) ? statuses.map((s: any) => ({ slug: s.slug, name: s.name })) : [];
      // Upsert into woo_cache
      const upserts = [
        { user_id: user.id, cache_key: "products", data: allProducts, updated_at: new Date().toISOString() },
        { user_id: user.id, cache_key: "payment_methods", data: paymentMethods, updated_at: new Date().toISOString() },
        { user_id: user.id, cache_key: "order_statuses", data: allStatuses, updated_at: new Date().toISOString() },
      ];
      for (const row of upserts) {
        await supabase.from("woo_cache" as any).upsert(row as any, { onConflict: "user_id,cache_key" });
      }
      toast({ title: "Cache reîmprospătat", description: `${allProducts.length} produse, ${paymentMethods.length} metode de plată, ${allStatuses.length} statusuri în cache.` });
    } catch (err) {
      toast({ title: "Cache refresh failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setRefreshingCache(false);
    }
  };

  const handleDelete = async () => {
    if (!existingConnection) return;
    await supabase.from("woo_connections").delete().eq("id", existingConnection.id);
    setExistingConnection(null); setConsumerKey(""); setConsumerSecret(""); setStoreName(""); setOrderStatuses([]); setSelectedStatuses([]); setPlugins([]); setSelectedPlugins([]);
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
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Globe className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle className="text-base">AI Response Language</CardTitle>
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
          <div className="space-y-2"><Label>Consumer Key</Label><div className="relative"><Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="ck_..." type={showConsumerKey ? "text" : "password"} className="pr-10" /><button type="button" onClick={() => setShowConsumerKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConsumerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          <div className="space-y-2"><Label>Consumer Secret</Label><div className="relative"><Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder="cs_..." type={showConsumerSecret ? "text" : "password"} className="pr-10" /><button type="button" onClick={() => setShowConsumerSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConsumerSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
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
              <>
                <Button onClick={() => refreshCache()} variant="outline" disabled={refreshingCache} className="gap-1.5">
                  <RefreshCw className={cn("h-4 w-4", refreshingCache && "animate-spin")} />
                  {refreshingCache ? "Refreshing…" : "Refresh Cache"}
                </Button>
                <Button onClick={handleDelete} variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </>
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

      {plugins.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle>Active Plugins</CardTitle>
                <CardDescription>Select which active plugins to track</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPlugins ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {plugins.map((p) => (
                  <label key={p.plugin} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors">
                    <Checkbox checked={selectedPlugins.includes(p.plugin)} onCheckedChange={() => togglePlugin(p.plugin)} />
                    <span className="text-sm flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">v{p.version}</span>
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

  const renderCredits = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Credits</h2>
          <p className="text-sm text-muted-foreground">Your credit balance and top-up options</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Coins className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">Current Balance</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCredits ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : creditBalance ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available credits</span>
                  <span className="font-semibold text-lg">{creditBalance.balance}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly allowance</span>
                  <span>{creditBalance.monthly_allowance}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last refill</span>
                  <span>{new Date(creditBalance.last_refill_at).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No credit balance found.</p>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-semibold mb-3">Top-Up Packs</h3>
          <p className="text-xs text-muted-foreground mb-4">One-time credit purchases. Contact your administrator to purchase.</p>
          <div className="grid grid-cols-2 gap-3">
            {topupPacks.map((pack) => (
              <Card key={pack.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-4 pb-4 text-center space-y-2">
                  <p className="font-semibold text-sm">{pack.name}</p>
                  <p className="text-2xl font-bold text-primary">{pack.credits}</p>
                  <p className="text-xs text-muted-foreground">credits</p>
                  <p className="text-sm font-medium">${(pack.price_cents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    ${(pack.price_cents / pack.credits / 100).toFixed(3)}/credit
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleSaveIntegration = async () => {
    if (!user) return;
    setSavingIntegration(true);
    try {
      const payload = {
        user_id: user.id,
        integration_key: "colete_online",
        is_enabled: coleteOnlineEnabled,
        config: { client_id: coleteClientId, client_secret: coleteClientSecret },
        updated_at: new Date().toISOString(),
      };
      await supabase.from("woo_integrations").upsert(payload as any, { onConflict: "user_id,integration_key" });
      toast({ title: "Saved!", description: "Colete Online integration updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save integration.", variant: "destructive" });
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleTestColeteOnline = async () => {
    if (!coleteClientId || !coleteClientSecret) {
      toast({ title: "Error", description: "Enter Client ID and Client Secret first.", variant: "destructive" });
      return;
    }
    setTestingColete(true);
    setColeteTestResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${supabaseUrl}/functions/v1/colete-online-tracker?action=test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ client_id: coleteClientId, client_secret: coleteClientSecret }),
      });
      const result = await resp.json();
      if (result.success) {
        setColeteTestResult("success");
        toast({ title: "Connection successful!", description: "Colete Online credentials are valid." });
      } else {
        setColeteTestResult("error");
        toast({ title: "Connection failed", description: result.error || "Invalid credentials.", variant: "destructive" });
      }
    } catch {
      setColeteTestResult("error");
      toast({ title: "Connection failed", description: "Could not reach Colete Online.", variant: "destructive" });
    } finally {
      setTestingColete(false);
    }
  };

  const renderIntegrations = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect third-party services to automate your workflow</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">Colete Online</CardTitle>
                <CardDescription>Automatic shipment tracking &amp; order status updates</CardDescription>
              </div>
            </div>
            <Switch checked={coleteOnlineEnabled} onCheckedChange={setColeteOnlineEnabled} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When enabled, the system checks every 2 hours for orders with AWBs from Colete Online. 
            Orders are automatically marked as "completed" once the shipment is delivered.
          </p>
          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input value={coleteClientId} onChange={(e) => setColeteClientId(e.target.value)} placeholder="Your Colete Online Client ID" />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <div className="relative">
              <Input type={showColeteSecret ? "text" : "password"} value={coleteClientSecret} onChange={(e) => setColeteClientSecret(e.target.value)} placeholder="Your Colete Online Client Secret" className="pr-10" />
              <button type="button" onClick={() => setShowColeteSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showColeteSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={handleTestColeteOnline} variant="outline" disabled={testingColete || !coleteClientId || !coleteClientSecret}>
              {testingColete ? "Testing…" : "Test Connection"}
              {coleteTestResult === "success" && <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-500" />}
              {coleteTestResult === "error" && <XCircle className="ml-1.5 h-4 w-4 text-destructive" />}
            </Button>
            <Button onClick={handleSaveIntegration} disabled={savingIntegration} className="gap-1.5">
              <Save className="h-4 w-4" /> {savingIntegration ? "Saving…" : "Save Integration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "general": return renderGeneral();
      case "appearance": return renderAppearance();
      case "connection": return renderConnection();
      case "integrations": return renderIntegrations();
      case "team": return <TeamSettings />;
      case "credits": return renderCredits();
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
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-semibold text-foreground">Settings</span>
          {onClose && (
            <button onClick={onClose} className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
