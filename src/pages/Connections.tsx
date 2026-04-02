import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Store, Save, Trash2, CheckCircle2, XCircle, ListChecks, Loader2,
  ArrowLeft, RefreshCw, Eye, EyeOff, Plug, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderStatus { slug: string; name: string; total: number; }

export default function Connections() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [storeUrl, setStoreUrl] = useState("https://kspices.ro");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [storeName, setStoreName] = useState("");
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [plugins, setPlugins] = useState<{ plugin: string; name: string; version: string }[]>([]);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState("English");

  // Cron logs
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Integrations summary
  const [integrations, setIntegrations] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    // Load connection
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
    supabase.from("woo_integrations").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setIntegrations(data);
    });
    // Load cron logs
    setLoadingLogs(true);
    supabase.from("cron_job_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10).then(({ data }) => {
      setCronLogs(data || []);
      setLoadingLogs(false);
    });
  }, [user]);

  const fetchOrderStatuses = async (url: string, ck: string, cs: string) => {
    setLoadingStatuses(true);
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "reports/orders/totals", storeUrl: url, consumerKey: ck, consumerSecret: cs },
      });
      if (error) throw error;
      if (Array.isArray(data)) setOrderStatuses(data.map((s: any) => ({ slug: s.slug, name: s.name, total: s.total })));
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
    } catch { /* silent */ } finally { setLoadingPlugins(false); }
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
        order_statuses: selectedStatuses, active_plugins: selectedPlugins,
      };
      if (existingConnection) {
        await supabase.from("woo_connections").update(payload as any).eq("id", existingConnection.id);
      } else {
        const { data } = await supabase.from("woo_connections").insert({ user_id: user.id, ...payload } as any).select().single();
        setExistingConnection(data);
      }
      toast({ title: "Salvat!", description: "Conexiunea a fost actualizată." });
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
    } catch { setTestResult("error"); toast({ title: "Conexiune eșuată", variant: "destructive" }); }
    finally { setTesting(false); }
  };

  const refreshCache = async () => {
    if (!user || !storeUrl || !consumerKey || !consumerSecret) return;
    setRefreshingCache(true);
    try {
      let allProducts: any[] = [];
      let page = 1;
      while (true) {
        const { data: products } = await supabase.functions.invoke("woo-proxy", {
          body: { endpoint: `products?per_page=100&page=${page}`, storeUrl, consumerKey, consumerSecret },
        });
        if (!Array.isArray(products) || products.length === 0) break;
        allProducts = [...allProducts, ...products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, regular_price: p.regular_price, stock_status: p.stock_status, images: p.images?.slice(0, 1) }))];
        if (products.length < 100) break;
        page++;
      }
      const { data: gateways } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "payment_gateways", storeUrl, consumerKey, consumerSecret },
      });
      const paymentMethods = Array.isArray(gateways) ? gateways.filter((g: any) => g.enabled).map((g: any) => ({ id: g.id, title: g.title })) : [];
      const { data: statuses } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "reports/orders/totals", storeUrl, consumerKey, consumerSecret },
      });
      const allStatuses = Array.isArray(statuses) ? statuses.map((s: any) => ({ slug: s.slug, name: s.name })) : [];
      const upserts = [
        { user_id: user.id, cache_key: "products", data: allProducts, updated_at: new Date().toISOString() },
        { user_id: user.id, cache_key: "payment_methods", data: paymentMethods, updated_at: new Date().toISOString() },
        { user_id: user.id, cache_key: "order_statuses", data: allStatuses, updated_at: new Date().toISOString() },
      ];
      for (const row of upserts) {
        await supabase.from("woo_cache" as any).upsert(row as any, { onConflict: "user_id,cache_key" });
      }
      toast({ title: "Cache reîmprospătat", description: `${allProducts.length} produse, ${paymentMethods.length} metode de plată.` });
    } catch (err) {
      toast({ title: "Reîmprospătare eșuată", description: err instanceof Error ? err.message : "Eroare", variant: "destructive" });
    } finally { setRefreshingCache(false); }
  };

  const handleDelete = async () => {
    if (!existingConnection) return;
    await supabase.from("woo_connections").delete().eq("id", existingConnection.id);
    setExistingConnection(null); setConsumerKey(""); setConsumerSecret(""); setStoreName(""); setOrderStatuses([]); setSelectedStatuses([]); setPlugins([]); setSelectedPlugins([]);
    toast({ title: "Șters", description: "Conexiunea WooCommerce a fost eliminată." });
  };

  const coleteIntegration = integrations.find(i => i.integration_key === "colete_online");

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Conexiuni</h1>
            <p className="text-xs text-muted-foreground">Magazin și integrări</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100dvh-57px)]">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          {/* WooCommerce Connection */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Store className="h-5 w-5 text-primary" /></div>
                <div>
                  <CardTitle>WooCommerce</CardTitle>
                  <CardDescription>Conexiunea magazinului tău</CardDescription>
                </div>
              </div>
              {existingConnection && (
                <Badge variant="outline" className="w-fit mt-2 gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Conectat{storeName ? ` — ${storeName}` : ""}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>URL Magazin</Label><Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://yourstore.com" /></div>
              <div className="space-y-2"><Label>Consumer Key</Label><div className="relative"><Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="ck_..." type={showConsumerKey ? "text" : "password"} className="pr-10" /><button type="button" onClick={() => setShowConsumerKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConsumerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="space-y-2"><Label>Consumer Secret</Label><div className="relative"><Input value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder="cs_..." type={showConsumerSecret ? "text" : "password"} className="pr-10" /><button type="button" onClick={() => setShowConsumerSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConsumerSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleTest} variant="outline" disabled={testing || !storeUrl || !consumerKey || !consumerSecret}>
                  {testing ? "Se testează…" : "Testează"}
                  {testResult === "success" && <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-500" />}
                  {testResult === "error" && <XCircle className="ml-1.5 h-4 w-4 text-destructive" />}
                </Button>
                <Button onClick={handleSave} disabled={saving || !storeUrl || !consumerKey || !consumerSecret} className="gap-1.5">
                  <Save className="h-4 w-4" /> {saving ? "Se salvează…" : "Salvează"}
                </Button>
                {existingConnection && (
                  <>
                    <Button onClick={refreshCache} variant="outline" disabled={refreshingCache} className="gap-1.5">
                      <RefreshCw className={cn("h-4 w-4", refreshingCache && "animate-spin")} />
                      {refreshingCache ? "Se reîmprospătează…" : "Cache"}
                    </Button>
                    <Button onClick={handleDelete} variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order statuses */}
          {orderStatuses.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-base">Statusuri comenzi</CardTitle>
                    <CardDescription>Selectează statusurile incluse implicit</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStatuses ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* Plugins */}
          {plugins.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-base">Plugin-uri active</CardTitle>
                    <CardDescription>Selectează ce plugin-uri să fie urmărite</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlugins ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* Integrations Summary */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Integrări</h2>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/integrations/colete-online")}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="rounded-lg bg-primary/10 p-2"><Package className="h-5 w-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Colete Online</p>
                  <p className="text-xs text-muted-foreground">Urmărire automată expedieri</p>
                </div>
                <Badge variant={coleteIntegration?.is_enabled ? "default" : "secondary"}>
                  {coleteIntegration?.is_enabled ? "Activ" : "Inactiv"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Cron History */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Istoric rulări automate</h2>
            {loadingLogs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă…</div>
            ) : cronLogs.length === 0 ? (
              <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nicio rulare înregistrată încă.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {cronLogs.map((log) => {
                  const summary = log.summary || {};
                  return (
                    <Card key={log.id}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                              {log.status === "success" ? "OK" : "Eroare"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString("ro-RO")}
                            </span>
                          </div>
                          {log.duration_ms && (
                            <span className="text-xs text-muted-foreground">{(log.duration_ms / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {summary.orders_scanned !== undefined && <span>Scanate: {summary.orders_scanned}</span>}
                          {summary.orders_with_awb !== undefined && <span>Cu AWB: {summary.orders_with_awb}</span>}
                          {summary.orders_completed > 0 && <span className="text-emerald-600 font-medium">Livrate: {summary.orders_completed}</span>}
                          {summary.orders_returned > 0 && <span className="text-orange-600 font-medium">Returnate: {summary.orders_returned}</span>}
                          {summary.errors > 0 && <span className="text-destructive font-medium">Erori: {summary.errors}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
