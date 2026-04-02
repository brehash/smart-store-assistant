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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Package, Save, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
} from "lucide-react";

interface OrderStatus { slug: string; name: string; total: number; }

export default function ColeteOnline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [coleteOnlineEnabled, setColeteOnlineEnabled] = useState(false);
  const [coleteClientId, setColeteClientId] = useState("");
  const [coleteClientSecret, setColeteClientSecret] = useState("");
  const [coleteDeliveredStatus, setColeteDeliveredStatus] = useState("completed");
  const [coleteReturnedStatus, setColeteReturnedStatus] = useState("refuzata");
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingColete, setTestingColete] = useState(false);
  const [coleteTestResult, setColeteTestResult] = useState<"success" | "error" | null>(null);
  const [showColeteSecret, setShowColeteSecret] = useState(false);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatus[]>([]);
  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Load integration
    supabase.from("woo_integrations").select("*").eq("user_id", user.id).eq("integration_key", "colete_online").maybeSingle().then(({ data }) => {
      if (data) {
        setColeteOnlineEnabled(data.is_enabled);
        const cfg = (data.config as any) || {};
        setColeteClientId(cfg.client_id || "");
        setColeteClientSecret(cfg.client_secret || "");
        setColeteDeliveredStatus(cfg.delivered_status || "completed");
        setColeteReturnedStatus(cfg.returned_status || "refuzata");
      }
      setLoaded(true);
    });

    // Load order statuses from connection
    supabase.from("woo_connections").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle().then(({ data }) => {
      if (data) {
        supabase.functions.invoke("woo-proxy", {
          body: { endpoint: "reports/orders/totals", storeUrl: data.store_url, consumerKey: data.consumer_key, consumerSecret: data.consumer_secret },
        }).then(({ data: statuses }) => {
          if (Array.isArray(statuses)) setOrderStatuses(statuses.map((s: any) => ({ slug: s.slug, name: s.name, total: s.total })));
        });
      }
    });

    // Load cron logs for this integration
    setLoadingLogs(true);
    supabase.from("cron_job_logs").select("*").eq("user_id", user.id).eq("job_name", "colete_online_worker").order("created_at", { ascending: false }).limit(10).then(({ data }) => {
      setCronLogs(data || []);
      setLoadingLogs(false);
    });
  }, [user]);

  const handleSaveIntegration = async () => {
    if (!user) return;
    setSavingIntegration(true);
    try {
      const payload = {
        user_id: user.id,
        integration_key: "colete_online",
        is_enabled: coleteOnlineEnabled,
        config: { client_id: coleteClientId, client_secret: coleteClientSecret, delivered_status: coleteDeliveredStatus, returned_status: coleteReturnedStatus },
        updated_at: new Date().toISOString(),
      };
      await supabase.from("woo_integrations").upsert(payload as any, { onConflict: "user_id,integration_key" });
      toast({ title: "Salvat!", description: "Integrarea Colete Online a fost actualizată." });
    } catch {
      toast({ title: "Eroare", description: "Salvarea a eșuat.", variant: "destructive" });
    } finally { setSavingIntegration(false); }
  };

  const handleTestColeteOnline = async () => {
    if (!coleteClientId || !coleteClientSecret) {
      toast({ title: "Eroare", description: "Introdu Client ID și Client Secret.", variant: "destructive" });
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
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ client_id: coleteClientId, client_secret: coleteClientSecret }),
      });
      const result = await resp.json();
      if (result.success) {
        setColeteTestResult("success");
        toast({ title: "Conexiune reușită!", description: "Credențialele sunt valide." });
      } else {
        setColeteTestResult("error");
        toast({ title: "Conexiune eșuată", description: result.error || "Credențiale invalide.", variant: "destructive" });
      }
    } catch {
      setColeteTestResult("error");
      toast({ title: "Conexiune eșuată", variant: "destructive" });
    } finally { setTestingColete(false); }
  };

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/connections")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5"><Package className="h-4 w-4 text-primary" /></div>
            <div>
              <h1 className="text-lg font-semibold">Colete Online</h1>
              <p className="text-xs text-muted-foreground">Urmărire automată expedieri</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100dvh-57px)]">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Configurare</CardTitle>
                <Switch checked={coleteOnlineEnabled} onCheckedChange={setColeteOnlineEnabled} />
              </div>
              <CardDescription>
                Când este activat, sistemul verifică periodic comenzile cu AWB-uri de la Colete Online și actualizează automat statusul în WooCommerce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input value={coleteClientId} onChange={(e) => setColeteClientId(e.target.value)} placeholder="Client ID Colete Online" />
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input type={showColeteSecret ? "text" : "password"} value={coleteClientSecret} onChange={(e) => setColeteClientSecret(e.target.value)} placeholder="Client Secret Colete Online" className="pr-10" />
                  <button type="button" onClick={() => setShowColeteSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showColeteSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>

              {orderStatuses.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Status la livrare</Label>
                    <Select value={coleteDeliveredStatus} onValueChange={setColeteDeliveredStatus}>
                      <SelectTrigger><SelectValue placeholder="Selectează status" /></SelectTrigger>
                      <SelectContent>
                        {orderStatuses.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Statusul setat automat când comanda este livrată</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Status la retur</Label>
                    <Select value={coleteReturnedStatus} onValueChange={setColeteReturnedStatus}>
                      <SelectTrigger><SelectValue placeholder="Selectează status" /></SelectTrigger>
                      <SelectContent>
                        {orderStatuses.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Statusul setat automat când expedierea este returnată</p>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button onClick={handleTestColeteOnline} variant="outline" disabled={testingColete || !coleteClientId || !coleteClientSecret}>
                  {testingColete ? "Se testează…" : "Testează"}
                  {coleteTestResult === "success" && <CheckCircle2 className="ml-1.5 h-4 w-4 text-emerald-500" />}
                  {coleteTestResult === "error" && <XCircle className="ml-1.5 h-4 w-4 text-destructive" />}
                </Button>
                <Button onClick={handleSaveIntegration} disabled={savingIntegration} className="gap-1.5">
                  <Save className="h-4 w-4" /> {savingIntegration ? "Se salvează…" : "Salvează"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cron History */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Istoric rulări</h2>
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
