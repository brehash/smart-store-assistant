import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface WebhookTopic {
  id: string;
  topic: string;
  label: string;
  description: string;
}

const WEBHOOK_TOPICS: WebhookTopic[] = [
  { id: "order-created", topic: "order.created", label: "Comandă nouă", description: "Primești notificare când se plasează o comandă nouă" },
  { id: "order-updated", topic: "order.updated", label: "Comandă actualizată", description: "Primești notificare când se schimbă statusul unei comenzi" },
  { id: "customer-created", topic: "customer.created", label: "Client nou", description: "Primești notificare când se înregistrează un client nou" },
];

interface WebhookSetupCardProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export function WebhookSetupCard({ onComplete, onDismiss }: WebhookSetupCardProps) {
  const { user, session } = useAuth();
  const [selected, setSelected] = useState<string[]>(WEBHOOK_TOPICS.map((t) => t.topic));
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<Record<string, "success" | "error">>({});
  const [done, setDone] = useState(false);

  const toggle = (topic: string) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleCreate = async () => {
    if (!user || !session) return;
    setCreating(true);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const deliveryBase = `https://${projectId}.supabase.co/functions/v1/webhook-receiver?uid=${user.id}`;

    const newResults: Record<string, "success" | "error"> = {};

    for (const topic of selected) {
      try {
        const { error } = await supabase.functions.invoke("woo-proxy", {
          body: {
            endpoint: "webhooks",
            method: "POST",
            body: {
              name: `Lovable - ${topic}`,
              topic,
              delivery_url: deliveryBase,
              status: "active",
              secret: user.id,
            },
          },
        });
        newResults[topic] = error ? "error" : "success";
      } catch {
        newResults[topic] = "error";
      }
    }

    setResults(newResults);
    setDone(true);
    setCreating(false);

    const allSuccess = selected.every((t) => newResults[t] === "success");
    if (allSuccess) {
      setTimeout(() => onComplete(), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-2 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Activează notificările în timp real</CardTitle>
              <CardDescription>
                Creează webhook-uri pentru a primi notificări instantanee despre evenimentele din magazin
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!done ? (
            <>
              <div className="space-y-3">
                {WEBHOOK_TOPICS.map((wh) => (
                  <label
                    key={wh.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selected.includes(wh.topic)}
                      onCheckedChange={() => toggle(wh.topic)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{wh.label}</p>
                      <p className="text-xs text-muted-foreground">{wh.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onDismiss} className="flex-1">
                  Skip
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || selected.length === 0}
                  className="flex-1 gap-2"
                >
                  {creating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    <>Create Webhooks</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {WEBHOOK_TOPICS.filter((wh) => selected.includes(wh.topic)).map((wh) => (
                <div key={wh.id} className="flex items-center justify-between text-sm">
                  <span>{wh.label}</span>
                  {results[wh.topic] === "success" ? (
                    <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Created
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 bg-destructive/10">
                      <XCircle className="h-3 w-3" /> Failed
                    </Badge>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={onComplete} className="w-full mt-2">
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
