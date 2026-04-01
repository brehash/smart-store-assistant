import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface TopupPack {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

export function PlansManager({ accessToken }: { accessToken: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<TopupPack>>>({});
  const [savingToggle, setSavingToggle] = useState(false);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin`;

  const { data: packs = [], isLoading: loading } = useQuery({
    queryKey: ["admin", "topup-packs"],
    queryFn: async () => {
      const resp = await fetch(`${baseUrl}/topup-packs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) return resp.json() as Promise<TopupPack[]>;
      return [];
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const { data: topupModalEnabled = true } = useQuery({
    queryKey: ["admin", "settings", "enable_topup_modal"],
    queryFn: async () => {
      const resp = await fetch(`${baseUrl}/settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const setting = data.find((s: any) => s.key === "enable_topup_modal");
        if (setting) return setting.value === true || setting.value === "true";
      }
      return true;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const fetchPacks = () => queryClient.invalidateQueries({ queryKey: ["admin", "topup-packs"] });

  const getEditValue = (pack: TopupPack, field: keyof TopupPack) => {
    return edits[pack.id]?.[field] ?? pack[field];
  };

  const setEditValue = (packId: string, field: keyof TopupPack, value: any) => {
    setEdits((prev) => ({ ...prev, [packId]: { ...prev[packId], [field]: value } }));
  };

  const handleSave = async (pack: TopupPack) => {
    const changes = edits[pack.id];
    if (!changes) return;
    setSaving(pack.id);
    try {
      const resp = await fetch(`${baseUrl}/topup-packs/${pack.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (resp.ok) {
        toast({ title: "Saved", description: `${pack.name} pack updated.` });
        setEdits((prev) => { const n = { ...prev }; delete n[pack.id]; return n; });
        fetchPacks();
      } else {
        const err = await resp.json();
        toast({ title: "Error", description: err.error || "Failed to save.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = async (pack: TopupPack) => {
    const newActive = !pack.is_active;
    setSaving(pack.id);
    try {
      const resp = await fetch(`${baseUrl}/topup-packs/${pack.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (resp.ok) {
        toast({ title: newActive ? "Enabled" : "Disabled", description: `${pack.name} pack ${newActive ? "enabled" : "disabled"}.` });
        fetchPacks();
      }
    } catch {
      toast({ title: "Error", description: "Failed to toggle.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleModal = async (enabled: boolean) => {
    setSavingToggle(true);
    try {
      const resp = await fetch(`${baseUrl}/settings/enable_topup_modal`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: enabled }),
      });
      if (resp.ok) {
        toast({ title: enabled ? "Enabled" : "Disabled", description: `Credit top-up modal ${enabled ? "enabled" : "disabled"} for users.` });
        queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
    } finally {
      setSavingToggle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Toggle */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable credit top-up modal for users</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, users can click their credits badge to see plans and top-ups</p>
            </div>
            <Switch checked={topupModalEnabled} onCheckedChange={handleToggleModal} disabled={savingToggle} />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Credit Top-Up Packs</h2>
        <p className="text-sm text-muted-foreground">Manage one-time credit purchase options visible to users</p>
      </div>

      <div className="grid gap-4">
        {packs.map((pack) => (
          <Card key={pack.id} className={!pack.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{pack.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{pack.is_active ? "Active" : "Inactive"}</span>
                  <Switch
                    checked={pack.is_active}
                    onCheckedChange={() => handleToggle(pack)}
                    disabled={saving === pack.id}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={getEditValue(pack, "name") as string}
                    onChange={(e) => setEditValue(pack.id, "name", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Credits</label>
                  <Input
                    type="number"
                    value={getEditValue(pack, "credits") as number}
                    onChange={(e) => setEditValue(pack.id, "credits", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Price (cents)</label>
                  <Input
                    type="number"
                    value={getEditValue(pack, "price_cents") as number}
                    onChange={(e) => setEditValue(pack.id, "price_cents", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  ${((getEditValue(pack, "price_cents") as number) / 100).toFixed(2)} → {getEditValue(pack, "credits")} credits
                  (${((getEditValue(pack, "price_cents") as number) / (getEditValue(pack, "credits") as number) / 100).toFixed(3)}/credit)
                </span>
                {edits[pack.id] && (
                  <Button size="sm" onClick={() => handleSave(pack)} disabled={saving === pack.id} className="gap-1.5 h-7">
                    {saving === pack.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
