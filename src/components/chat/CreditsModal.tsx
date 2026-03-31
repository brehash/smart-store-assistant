import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Crown, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  monthly_price_cents: number;
  credits: number;
  description: string | null;
  is_active: boolean;
}

interface TopupPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number | null;
  currentPlanId?: string | null;
}

export function CreditsModal({ open, onOpenChange, currentBalance, currentPlanId }: Props) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [packs, setPacks] = useState<TopupPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [plansRes, packsRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("credit_topup_packs").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setPlans((plansRes.data || []) as SubscriptionPlan[]);
      setPacks((packsRes.data || []) as TopupPack[]);
      setLoading(false);
    })();
  }, [open]);

  const currentPlan = plans.find((p) => p.id === currentPlanId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Credite & Planuri
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Balance */}
            <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold curent</p>
                <p className="text-3xl font-bold tabular-nums">{currentBalance ?? 0} <span className="text-base font-normal text-muted-foreground">credite</span></p>
              </div>
              {currentPlan && (
                <Badge variant="secondary" className="text-sm">
                  <Crown className="h-3 w-3 mr-1" />
                  {currentPlan.name}
                </Badge>
              )}
            </div>

            {/* Subscription Plans */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Planuri de abonament</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const isCurrent = plan.id === currentPlanId;
                  return (
                    <Card key={plan.id} className={`relative ${isCurrent ? "border-primary" : ""}`}>
                      {isCurrent && (
                        <Badge className="absolute -top-2 right-3 text-xs">Curent</Badge>
                      )}
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-baseline justify-between mb-1">
                          <h4 className="font-semibold">{plan.name}</h4>
                          <span className="text-lg font-bold">${(plan.monthly_price_cents / 100).toFixed(0)}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{plan.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{plan.credits} credite/lună</span>
                          {!isCurrent && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                              Contactează Admin
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Top-Up Packs */}
            {packs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Încărcări unice</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {packs.map((pack) => (
                    <div key={pack.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{pack.name}</p>
                          <p className="text-xs text-muted-foreground">{pack.credits} credite</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                        ${(pack.price_cents / 100).toFixed(2)}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Contactează administratorul pentru a achiziționa credite sau a-ți actualiza planul.
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
