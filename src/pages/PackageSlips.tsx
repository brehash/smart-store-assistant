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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package, RefreshCw, CheckCircle2, Loader2, Printer, Trash2 } from "lucide-react";

interface LineItem {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  image?: { src: string };
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
  image?: string;
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
  const [collectedByKey, setCollectedByKey] = useState<Record<string, number>>({});

  // Confirmation dialog state
  const [confirmOrderId, setConfirmOrderId] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const autoLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // localStorage keys
  const lsCollected = user ? `ps_collected_${user.id}` : "";
  const lsOrders = user ? `ps_orders_${user.id}` : "";
  const lsPacked = user ? `ps_packed_${user.id}` : "";

  // Restore from localStorage on mount
  useEffect(() => {
    if (!user) return;
    try {
      const savedOrders = localStorage.getItem(lsOrders);
      if (savedOrders) setOrders(JSON.parse(savedOrders));
      const savedCollected = localStorage.getItem(lsCollected);
      if (savedCollected) setCollectedByKey(JSON.parse(savedCollected));
      const savedPacked = localStorage.getItem(lsPacked);
      if (savedPacked) setPackedIds(new Set(JSON.parse(savedPacked)));
    } catch {}
  }, [user]);

  // Persist to localStorage
  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem(lsCollected, JSON.stringify(collectedByKey)); } catch {}
  }, [collectedByKey, user]);

  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem(lsOrders, JSON.stringify(orders)); } catch {}
  }, [orders, user]);

  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem(lsPacked, JSON.stringify(Array.from(packedIds))); } catch {}
  }, [packedIds, user]);

  // Load statuses from woo_connections
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let { data } = await supabase
        .from("woo_connections")
        .select("order_statuses")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!data) {
        const { data: membership } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (membership) {
          setAllStatuses(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]);
          return;
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

  // Auto-load orders when preferences are loaded and statuses configured
  useEffect(() => {
    if (!prefsLoaded || autoLoadDone.current) return;
    if (sourceStatuses.length > 0 && targetStatus) {
      autoLoadDone.current = true;
      // Small delay to let restored localStorage state settle
      setTimeout(() => loadOrders(), 300);
    }
  }, [prefsLoaded, sourceStatuses, targetStatus]);

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

  const collectOne = (key: string, totalQty: number) => {
    setCollectedByKey((prev) => ({
      ...prev,
      [key]: Math.min((prev[key] || 0) + 1, totalQty),
    }));
  };

  const uncollectOne = (key: string) => {
    setCollectedByKey((prev) => ({
      ...prev,
      [key]: Math.max((prev[key] || 0) - 1, 0),
    }));
  };

  // Load orders (merge mode — preserves collected state)
  const loadOrders = async () => {
    if (sourceStatuses.length === 0) {
      toast({ title: "Select at least one source status", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const statusParam = sourceStatuses.join(",");
      const { data, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: `orders?status=${statusParam}&per_page=100&orderby=date&order=asc`, method: "GET" },
      });
      if (error) throw error;
      if (Array.isArray(data)) {
        setOrders(data);
        // Prune collectedByKey: keep only keys that exist in new pick list
        const newKeys = new Set<string>();
        for (const order of data as Order[]) {
          for (const item of order.line_items) {
            newKeys.add(item.sku || String(item.product_id));
          }
        }
        setCollectedByKey((prev) => {
          const pruned: Record<string, number> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (newKeys.has(k)) pruned[k] = v;
          }
          return pruned;
        });
        // Prune packedIds: keep only ids still in the new orders
        const newOrderIds = new Set((data as Order[]).map((o) => o.id));
        setPackedIds((prev) => {
          const pruned = new Set<number>();
          for (const id of prev) {
            if (newOrderIds.has(id)) pruned.add(id);
          }
          return pruned;
        });
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

  // Clear session
  const clearSession = () => {
    setOrders([]);
    setCollectedByKey({});
    setPackedIds(new Set());
    if (user) {
      try {
        localStorage.removeItem(lsOrders);
        localStorage.removeItem(lsCollected);
        localStorage.removeItem(lsPacked);
      } catch {}
    }
    toast({ title: "Session cleared" });
  };

  // Realtime: auto-add new orders from webhook events
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("ps_webhook_orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "webhook_events", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const event = payload.new as any;
          if (!event.topic?.startsWith("order.")) return;
          const orderData = event.payload as any;
          if (!orderData?.id) return;

          // Check if status matches our source statuses
          const orderStatus = orderData.status;
          if (!sourceStatuses.includes(orderStatus)) return;

          // Merge into orders
          setOrders((prev) => {
            const exists = prev.findIndex((o) => o.id === orderData.id);
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = orderData;
              return updated;
            }
            return [...prev, orderData];
          });

          toast({ title: `New order #${orderData.number || orderData.id} added` });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sourceStatuses]);

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
          map.set(key, { key, name: item.name, sku: item.sku || "-", totalQty: item.quantity, image: item.image?.src });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
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
    for (const order of unpacked) {
      await markAsPacked(order.id);
    }
  };

  const formatAddress = (s: Order["shipping"]) =>
    [s.first_name, s.last_name, s.company, s.address_1, s.address_2, s.postcode, s.city, s.country]
      .filter(Boolean)
      .join(", ");

  const printSlip = (order: Order) => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const items = order.line_items
      .map(
        (li) =>
          `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;">${li.quantity}×</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;word-break:break-word;">${li.name}${li.sku ? ` <span style="color:#888;font-size:11px;">(${li.sku})</span>` : ""}</td>
          </tr>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Slip #${order.number}</title>
      <style>body{font-family:sans-serif;margin:20px;color:#111}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}@media print{button{display:none}}</style>
      </head><body>
      <h2>Order #${order.number}</h2>
      <p style="font-size:12px;color:#666;margin:0 0 12px">${new Date(order.date_created).toLocaleDateString()}</p>
      <p style="font-size:13px;margin:0 0 4px"><strong>${order.shipping.first_name} ${order.shipping.last_name}</strong>${order.shipping.company ? ` — ${order.shipping.company}` : ""}</p>
      <p style="font-size:12px;color:#444;margin:0 0 16px">${formatAddress(order.shipping)}</p>
      ${order.billing.phone ? `<p style="font-size:12px;margin:0 0 16px">📞 ${order.billing.phone}</p>` : ""}
      <table>${items}</table>
      <br/><button onclick="window.print()" style="padding:8px 16px;cursor:pointer">Print</button>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // Get the order for confirmation dialog
  const confirmOrder = confirmOrderId ? orders.find((o) => o.id === confirmOrderId) : null;
  const unpackedOrders = orders.filter((o) => !packedIds.has(o.id));

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Package className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Package Slips</h1>
      </div>

      {/* Config bar — stacked on mobile */}
      <div className="border-b border-border px-3 py-2 space-y-2">
        {/* Source statuses */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fetch orders with status</label>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {allStatuses.map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer">
                <Checkbox
                  className="h-3.5 w-3.5"
                  checked={sourceStatuses.includes(s)}
                  onCheckedChange={() => toggleSourceStatus(s)}
                />
                <span className="text-xs capitalize">{s.replace(/-/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* Target status */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">After packing</label>
            <Select value={targetStatus} onValueChange={handleTargetChange}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize text-xs">{s.replace(/-/g, " ")}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="h-8 text-xs" onClick={loadOrders} disabled={loading || sourceStatuses.length === 0}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Load Orders
          </Button>
          {orders.length > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={clearSession}>
              <Trash2 className="h-3 w-3 mr-1" />
              Clear Session
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {orders.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
            <Package className="h-10 w-10" />
            <p className="text-xs">Select statuses and load orders to begin</p>
          </div>
        )}

        {orders.length > 0 && (
          <Tabs defaultValue="picklist" className="flex flex-col h-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <TabsList className="h-8">
                <TabsTrigger value="picklist" className="text-xs h-7 px-3">Pick List</TabsTrigger>
                <TabsTrigger value="slips" className="text-xs h-7 px-3">Slips ({orders.length})</TabsTrigger>
              </TabsList>
              {targetStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfirmAll(true)}
                  disabled={packedIds.size === orders.length}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Mark All ({unpackedOrders.length})
                </Button>
              )}
            </div>

            {/* Pick List */}
            <TabsContent value="picklist" className="flex-1 overflow-auto m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 px-2"></TableHead>
                    <TableHead className="text-xs px-2">Product</TableHead>
                    <TableHead className="text-xs px-2 text-right w-16">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickList.map((item) => {
                    const collectedQty = collectedByKey[item.key] ?? 0;
                    const finished = collectedQty >= item.totalQty;
                    return (
                      <TableRow
                        key={item.key}
                        className={finished ? "opacity-50" : ""}
                      >
                        <TableCell className="px-2 py-1">
                          <Checkbox
                            className="h-3.5 w-3.5"
                            checked={finished}
                            onCheckedChange={() => {
                              if (finished) {
                                uncollectOne(item.key);
                              } else {
                                collectOne(item.key, item.totalQty);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <div className="flex items-center gap-2">
                            {item.image && (
                              <img
                                src={item.image}
                                alt=""
                                className="h-8 w-8 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className={`text-xs font-medium break-words ${finished ? "line-through" : ""}`}>{item.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-right">
                          <span className={`text-sm font-semibold ${finished ? "text-green-600" : ""}`}>
                            {collectedQty} / {item.totalQty}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pickList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No items</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Order Slips */}
            <TabsContent value="slips" className="flex-1 overflow-auto m-0 p-2">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {orders.map((order) => {
                  const isPacked = packedIds.has(order.id);
                  const isUpdating = updatingIds.has(order.id);
                  return (
                    <Card key={order.id} className={`${isPacked ? "opacity-50 border-primary/30" : ""}`}>
                      <CardHeader className="px-3 py-2 pb-1">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">#{order.number}</CardTitle>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">
                              {order.status.replace(/-/g, " ")}
                            </Badge>
                            {isPacked && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {order.shipping.first_name} {order.shipping.last_name}
                          {order.shipping.company ? ` · ${order.shipping.company}` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{formatAddress(order.shipping)}</p>
                      </CardHeader>
                      <CardContent className="px-3 py-1 space-y-1">
                        {order.line_items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 py-0.5">
                            {item.image?.src && (
                              <img
                                src={item.image.src}
                                alt=""
                                className="h-7 w-7 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <span className="text-xs flex-1 min-w-0 break-words">{item.name}</span>
                            <span className="text-xs font-semibold flex-shrink-0">×{item.quantity}</span>
                          </div>
                        ))}
                        <div className="flex gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => printSlip(order)}
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            Print
                          </Button>
                          {!isPacked && targetStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              disabled={isUpdating}
                              onClick={() => setConfirmOrderId(order.id)}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Mark as Packed
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Confirmation dialog — single order */}
      <AlertDialog open={!!confirmOrder} onOpenChange={(open) => { if (!open) setConfirmOrderId(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm packing — #{confirmOrder?.number}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {confirmOrder?.shipping.first_name} {confirmOrder?.shipping.last_name}
                </p>
                <div className="space-y-1">
                  {confirmOrder?.line_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {item.image?.src && (
                        <img src={item.image.src} alt="" className="h-6 w-6 rounded object-cover" />
                      )}
                      <span className="flex-1 break-words">{item.name}</span>
                      <span className="font-semibold">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Status will change to <span className="font-medium capitalize">{targetStatus.replace(/-/g, " ")}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs"
              onClick={() => {
                if (confirmOrderId) markAsPacked(confirmOrderId);
                setConfirmOrderId(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog — mark all */}
      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Mark all as packed?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {unpackedOrders.length} order{unpackedOrders.length !== 1 ? "s" : ""} will be updated to{" "}
                  <span className="font-medium capitalize">{targetStatus.replace(/-/g, " ")}</span>.
                </p>
                <div className="max-h-32 overflow-auto space-y-0.5">
                  {unpackedOrders.map((o) => (
                    <p key={o.id} className="text-xs">
                      #{o.number} — {o.shipping.first_name} {o.shipping.last_name} ({o.line_items.length} items)
                    </p>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs"
              onClick={() => {
                markAllAsPacked();
                setConfirmAll(false);
              }}
            >
              Confirm All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
