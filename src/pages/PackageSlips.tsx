import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";

interface LineItem {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
}

interface Order {
  id: number;
  number: string;
  status: string;
  billing: { first_name: string; last_name: string; company?: string; address_1?: string; city?: string; postcode?: string; country?: string; phone?: string };
  shipping: { first_name: string; last_name: string; company?: string; address_1?: string; address_2?: string; city?: string; postcode?: string; country?: string };
  line_items: LineItem[];
  date_created: string;
}

interface PickItem {
  key: string;
  name: string;
  sku: string;
  totalQty: number;
}

export default function PackageSlips() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allStatuses, setAllStatuses] = useState<string[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [packedIds, setPackedIds] = useState<Set<number>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load statuses from woo_connections
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Try own connection first
      let { data } = await supabase
        .from("woo_connections")
        .select("order_statuses")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      // Fallback: team owner
      if (!data) {
        const { data: membership } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (membership) {
          const { data: team } = await supabase
            .from("teams")
            .select("owner_id")
            .eq("id", membership.team_id)
            .single();
          if (team) {
            // We can't read owner's woo_connections due to RLS, so just use common statuses
            setAllStatuses(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]);
            return;
          }
        }
      }

      if (data?.order_statuses && (data.order_statuses as string[]).length > 0) {
        setAllStatuses(data.order_statuses as string[]);
      } else {
        setAllStatuses(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]);
      }
    };
    load();
  }, [user]);

  // Load saved preferences
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("preference_type", "package_slip_config")
        .eq("key", "default")
        .maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        if (val.sourceStatuses) setSourceStatuses(val.sourceStatuses);
        if (val.targetStatus) setTargetStatus(val.targetStatus);
      }
      setPrefsLoaded(true);
    };
    load();
  }, [user]);

  // Save preferences (debounced)
  const savePrefs = useCallback(
    (src: string[], tgt: string) => {
      if (!user || !prefsLoaded) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await supabase.from("user_preferences").upsert(
          {
            user_id: user.id,
            preference_type: "package_slip_config",
            key: "default",
            value: { sourceStatuses: src, targetStatus: tgt },
          } as any,
          { onConflict: "user_id,preference_type,key" }
        );
      }, 800);
    },
    [user, prefsLoaded]
  );

  const toggleSourceStatus = (status: string) => {
    const next = sourceStatuses.includes(status)
      ? sourceStatuses.filter((s) => s !== status)
      : [...sourceStatuses, status];
    setSourceStatuses(next);
    savePrefs(next, targetStatus);
  };

  const handleTargetChange = (val: string) => {
    setTargetStatus(val);
    savePrefs(sourceStatuses, val);
  };

  // Load orders
  const loadOrders = async () => {
    if (sourceStatuses.length === 0) {
      toast({ title: "Select at least one source status", variant: "destructive" });
      return;
    }
    setLoading(true);
    setOrders([]);
    setPackedIds(new Set());
    try {
      const statusParam = sourceStatuses.join(",");
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: `orders?status=${statusParam}&per_page=100&orderby=date&order=asc`, method: "GET" },
      });
      if (error) throw error;
      if (Array.isArray(data)) {
        setOrders(data);
      } else if (data?.message || data?.code) {
        throw new Error(data.message || "Failed to fetch orders");
      } else {
        setOrders([]);
      }
    } catch (e: any) {
      toast({ title: "Error loading orders", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Build pick list
  const pickList: PickItem[] = (() => {
    const map = new Map<string, PickItem>();
    for (const order of orders) {
      for (const item of order.line_items) {
        const key = item.sku || String(item.product_id);
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += item.quantity;
        } else {
          map.set(key, { key, name: item.name, sku: item.sku || "-", totalQty: item.quantity });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Mark single order as packed
  const markAsPacked = async (orderId: number) => {
    if (!targetStatus) {
      toast({ title: "Select a target status first", variant: "destructive" });
      return;
    }
    setUpdatingIds((prev) => new Set(prev).add(orderId));
    try {
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: `orders/${orderId}`, method: "PUT", body: { status: targetStatus } },
      });
      if (error) throw error;
      if (data?.id) {
        setPackedIds((prev) => new Set(prev).add(orderId));
        toast({ title: `Order #${orders.find((o) => o.id === orderId)?.number || orderId} → ${targetStatus}` });
      }
    } catch (e: any) {
      toast({ title: "Error updating order", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Mark all as packed
  const markAllAsPacked = async () => {
    const unpacked = orders.filter((o) => !packedIds.has(o.id));
    if (unpacked.length === 0) return;
    for (const order of unpacked) {
      await markAsPacked(order.id);
    }
  };

  const formatAddress = (s: Order["shipping"]) =>
    [s.first_name, s.last_name, s.company, s.address_1, s.address_2, s.postcode, s.city, s.country]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Package Slips</h1>
      </div>

      {/* Config bar */}
      <div className="border-b border-border px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-start gap-6">
          {/* Source statuses */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fetch orders with status</label>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={sourceStatuses.includes(s)}
                    onCheckedChange={() => toggleSourceStatus(s)}
                  />
                  <span className="text-sm capitalize">{s.replace(/-/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Target status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Set status after packing</label>
            <Select value={targetStatus} onValueChange={handleTargetChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s.replace(/-/g, " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 pt-4">
            <Button onClick={loadOrders} disabled={loading || sourceStatuses.length === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Load Orders
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {orders.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Package className="h-12 w-12" />
            <p className="text-sm">Select order statuses and click Load Orders to begin</p>
          </div>
        )}

        {orders.length > 0 && (
          <Tabs defaultValue="picklist" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="picklist">Pick List</TabsTrigger>
                <TabsTrigger value="slips">Order Slips ({orders.length})</TabsTrigger>
              </TabsList>
              {targetStatus && (
                <Button
                  variant="outline"
                  onClick={markAllAsPacked}
                  disabled={packedIds.size === orders.length}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark All as Packed ({orders.length - packedIds.size})
                </Button>
              )}
            </div>

            {/* Pick List */}
            <TabsContent value="picklist">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Products to Pick</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Total Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pickList.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                          <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                        </TableRow>
                      ))}
                      {pickList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">No items</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Order Slips */}
            <TabsContent value="slips">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orders.map((order) => {
                  const isPacked = packedIds.has(order.id);
                  const isUpdating = updatingIds.has(order.id);
                  return (
                    <Card key={order.id} className={isPacked ? "opacity-60 border-primary/30" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">
                            Order #{order.number}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {order.status.replace(/-/g, " ")}
                            </Badge>
                            {isPacked && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.shipping.first_name} {order.shipping.last_name}
                          {order.shipping.company ? ` · ${order.shipping.company}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatAddress(order.shipping)}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Item</TableHead>
                              <TableHead className="text-xs text-right">Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.line_items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm py-1">
                                  {item.name}
                                  {item.sku && <span className="text-muted-foreground text-xs ml-1">({item.sku})</span>}
                                </TableCell>
                                <TableCell className="text-sm py-1 text-right font-semibold">{item.quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {!isPacked && targetStatus && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={isUpdating}
                            onClick={() => markAsPacked(order.id)}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Mark as Packed
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
