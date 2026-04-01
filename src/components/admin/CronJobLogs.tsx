import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RefreshCw, Play, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, MinusCircle, Truck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CheckedOrder {
  orderId: number;
  awb: string;
  uniqueId: string;
  wooStatus: string;
  shippingStatus: string | null;
  shippingCode: number | null;
  action: "completed" | "in_transit" | "no_history" | "error";
}

interface CronLog {
  id: string;
  job_name: string;
  status: string;
  summary: {
    integrations_checked?: number;
    orders_scanned?: number;
    orders_completed?: number;
    errors?: number;
    fatal_error?: string;
    workers_dispatched?: number;
    workers_failed?: number;
    total_integrations?: number;
  };
  details: Array<{
    userId: string;
    storeName: string | null;
    authStatus: string;
    ordersScanned: number;
    ordersWithAwb: number;
    ordersCompleted: number;
    checkedOrders?: CheckedOrder[];
    completedOrders?: Array<{ orderId: number; awb: string; uniqueId: string }>;
    errors: Array<{ step: string; orderId?: number; awb?: string; error: string }>;
  }>;
  duration_ms: number | null;
  created_at: string;
}

export function CronJobLogs({ accessToken }: { accessToken: string }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey: ["admin", "cron-logs"],
    queryFn: async () => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/cron-logs`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (resp.ok) return resp.json() as Promise<CronLog[]>;
      return [];
    },
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
  });

  const fetchLogs = () => queryClient.invalidateQueries({ queryKey: ["admin", "cron-logs"] });

  const runNow = async () => {
    setRunning(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/colete-online-tracker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ time: new Date().toISOString() }),
        }
      );
      const data = await resp.json();
      if (resp.ok) {
        toast.success("Cron job executed successfully");
        fetchLogs();
      } else {
        toast.error(`Cron job failed: ${data.error || "Unknown error"}`);
      }
    } catch (e) {
      toast.error("Failed to trigger cron job");
  } finally {
      setRunning(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      case "no_integrations": return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "success": return "default";
      case "error": return "destructive";
      default: return "secondary";
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Colete Online Tracker — Execution Logs</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            <Play className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Run Now"}
          </Button>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">Loading logs…</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No execution logs yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Type</TableHead>
                <TableHead className="text-right">Scanned / Dispatched</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const isOrchestrator = log.summary.workers_dispatched != null;
                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : log.id)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="text-sm">{formatTime(log.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(log.status)} className="gap-1">
                              {statusIcon(log.status)}
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDuration(log.duration_ms)}</TableCell>
                          <TableCell className="text-right text-sm">
                            <Badge variant="outline" className="text-[10px]">
                              {isOrchestrator ? "orchestrator" : "worker"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {isOrchestrator
                              ? `${log.summary.workers_dispatched} dispatched`
                              : log.summary.orders_scanned ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {isOrchestrator
                              ? `${(log.summary.workers_dispatched ?? 0) - (log.summary.workers_failed ?? 0)} ok`
                              : log.summary.orders_completed ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {isOrchestrator ? log.summary.workers_failed ?? 0 : log.summary.errors ?? 0}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div className="bg-muted/30 p-4 space-y-3">
                              {log.summary.fatal_error && (
                                <Card className="border-destructive">
                                  <CardContent className="p-3">
                                    <p className="text-sm text-destructive font-medium">Fatal Error: {log.summary.fatal_error}</p>
                                  </CardContent>
                                </Card>
                              )}
                              {Array.isArray(log.details) && log.details.length > 0 ? (
                                log.details.map((detail, i) => (
                                  <Card key={i}>
                                    <CardHeader className="pb-2 pt-3 px-4">
                                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                                        <span>{detail.storeName || detail.userId}</span>
                                        <Badge variant={detail.authStatus === "success" ? "default" : "destructive"} className="text-xs">
                                          Auth: {detail.authStatus}
                                        </Badge>
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-3 space-y-2">
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div><span className="text-muted-foreground">Scanned:</span> {detail.ordersScanned}</div>
                                        <div><span className="text-muted-foreground">With AWB:</span> {detail.ordersWithAwb}</div>
                                        <div><span className="text-muted-foreground">Completed:</span> {detail.ordersCompleted}</div>
                                      </div>
                                      {detail.checkedOrders && detail.checkedOrders.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">Checked Orders ({detail.checkedOrders.length}):</p>
                                          <div className="rounded-md border bg-background overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-xs h-8 px-2">Order #</TableHead>
                                                  <TableHead className="text-xs h-8 px-2">AWB</TableHead>
                                                  <TableHead className="text-xs h-8 px-2">WooCommerce</TableHead>
                                                  <TableHead className="text-xs h-8 px-2">Shipping Status</TableHead>
                                                  <TableHead className="text-xs h-8 px-2">Action</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {detail.checkedOrders.map((o, j) => (
                                                  <TableRow key={j}>
                                                    <TableCell className="text-xs px-2 py-1.5 font-medium">#{o.orderId}</TableCell>
                                                    <TableCell className="text-xs px-2 py-1.5 font-mono">{o.awb || "—"}</TableCell>
                                                    <TableCell className="text-xs px-2 py-1.5">
                                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{o.wooStatus}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs px-2 py-1.5">
                                                      {o.shippingStatus ? (
                                                        <span>{o.shippingStatus}{o.shippingCode ? ` (${o.shippingCode})` : ""}</span>
                                                      ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs px-2 py-1.5">
                                                      {o.action === "completed" && (
                                                        <span className="inline-flex items-center gap-1 text-green-600">
                                                          <CheckCircle2 className="h-3 w-3" /> Completed
                                                        </span>
                                                      )}
                                                      {o.action === "in_transit" && (
                                                        <span className="inline-flex items-center gap-1 text-amber-500">
                                                          <Truck className="h-3 w-3" /> In Transit
                                                        </span>
                                                      )}
                                                      {o.action === "no_history" && (
                                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                          <MinusCircle className="h-3 w-3" /> No History
                                                        </span>
                                                      )}
                                                      {o.action === "error" && (
                                                        <span className="inline-flex items-center gap-1 text-destructive">
                                                          <AlertTriangle className="h-3 w-3" /> Error
                                                        </span>
                                                      )}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      )}
                                      {/* Backward compat: show old completedOrders if checkedOrders missing */}
                                      {(!detail.checkedOrders || detail.checkedOrders.length === 0) && detail.completedOrders && detail.completedOrders.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">Completed Orders:</p>
                                          <div className="space-y-1">
                                            {detail.completedOrders.map((o, j) => (
                                              <div key={j} className="text-xs bg-background rounded px-2 py-1">
                                                Order #{o.orderId} — AWB: {o.awb}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {Array.isArray(detail.errors) && detail.errors.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-destructive mb-1">Errors:</p>
                                          <div className="space-y-1">
                                            {detail.errors.map((err, j) => (
                                              <div key={j} className="text-xs bg-destructive/10 text-destructive rounded px-2 py-1">
                                                [{err.step}] {err.orderId ? `Order #${err.orderId}` : ""} {err.error}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">No detailed breakdown available.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
