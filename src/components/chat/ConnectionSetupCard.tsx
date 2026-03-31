import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Store, CheckCircle2, XCircle, Loader2, ArrowRight, ExternalLink } from "lucide-react";

interface ConnectionSetupCardProps {
  onComplete: () => void;
}

export function ConnectionSetupCard({ onComplete }: ConnectionSetupCardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [storeName, setStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("woo-proxy", {
        body: { action: "test", storeUrl, consumerKey, consumerSecret },
      });
      if (fnError) throw fnError;
      setTestResult("success");
      setStoreName(data?.name || storeUrl);
    } catch (e) {
      setTestResult("error");
      setError("Connection failed. Check your store URL and API credentials.");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Fetch order statuses and plugins in parallel
      const [statusRes, pluginRes] = await Promise.all([
        supabase.functions.invoke("woo-proxy", {
          body: { endpoint: "reports/orders/totals", storeUrl, consumerKey, consumerSecret },
        }),
        supabase.functions.invoke("woo-proxy", {
          body: { endpoint: "system_status", storeUrl, consumerKey, consumerSecret },
        }),
      ]);

      const orderStatuses = Array.isArray(statusRes.data)
        ? statusRes.data.map((s: any) => s.slug)
        : [];

      const activePlugins = pluginRes.data?.active_plugins && Array.isArray(pluginRes.data.active_plugins)
        ? pluginRes.data.active_plugins.map((p: any) => p.plugin)
        : [];

      await supabase.from("woo_connections").insert({
        user_id: user.id,
        store_url: storeUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        store_name: storeName,
        order_statuses: orderStatuses,
        active_plugins: activePlugins,
      } as any);

      setStep(4);
      // Delay to show success before transitioning
      setTimeout(() => onComplete(), 1500);
    } catch {
      setError("Failed to save connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto rounded-2xl bg-primary/10 p-4 mb-3">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Conectează-ți magazinul</CardTitle>
          <CardDescription>
            Configurează conexiunea WooCommerce pentru a începe
          </CardDescription>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>URL Magazin</Label>
                <Input
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://yourstore.com"
                />
                <p className="text-xs text-muted-foreground">
                  Introdu URL-ul complet al magazinului tău WooCommerce
                </p>
              </div>
              <Button
                onClick={() => setStep(2)}
                disabled={!storeUrl.trim()}
                className="w-full gap-2"
              >
                Următorul <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Consumer Key</Label>
                <Input
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="ck_..."
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <Label>Consumer Secret</Label>
                <Input
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="cs_..."
                  type="password"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Le găsești în WooCommerce → Setări → Avansat → REST API
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!consumerKey.trim() || !consumerSecret.trim()}
                  className="flex-1 gap-2"
                >
                  Următorul <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Magazin</span>
                  <span className="font-medium truncate ml-4">{storeUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Key</span>
                  <span className="font-mono text-xs">
                    {consumerKey.slice(0, 8)}...
                  </span>
                </div>
              </div>

              {testResult === "success" && (
                <Badge variant="outline" className="w-full justify-center gap-1.5 py-2 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected to {storeName}
                </Badge>
              )}

              {testResult === "error" && (
                <Badge variant="outline" className="w-full justify-center gap-1.5 py-2 text-destructive border-destructive/30 bg-destructive/10">
                  <XCircle className="h-4 w-4" />
                  {error}
                </Badge>
              )}

              {error && !testResult && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                {testResult === "success" ? (
                  <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                      <>Save & Continue</>
                    )}
                  </Button>
                ) : (
                  <Button onClick={handleTest} disabled={testing} className="flex-1 gap-2">
                    {testing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Testing...</>
                    ) : (
                      <>Test Connection</>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-lg">Connected!</p>
              <p className="text-sm text-muted-foreground">
                Your store {storeName} is ready. Setting up...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
