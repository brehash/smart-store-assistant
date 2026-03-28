import { Package, CheckCircle2, Truck, MapPin, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ShippingEvent {
  code: number;
  name: string;
  reason: string;
  date: string;
  comment: string;
}

interface ShippingData {
  order_id: number | string;
  awb: string;
  courier: string;
  service: string;
  provider: string;
  is_delivered: boolean;
  current_status: { code: number; name: string; reason: string; date: string; comment: string } | null;
  history: ShippingEvent[];
}

function statusColor(code: number) {
  if (code === 20800 || code === 30500) return "delivered";
  if (code >= 20500) return "transit";
  if (code === 20050) return "pickup";
  return "initial";
}

const colorMap = {
  delivered: { dot: "bg-green-500", line: "bg-green-300", text: "text-green-700 dark:text-green-400" },
  transit: { dot: "bg-blue-500", line: "bg-blue-300", text: "text-blue-700 dark:text-blue-400" },
  pickup: { dot: "bg-yellow-500", line: "bg-yellow-300", text: "text-yellow-700 dark:text-yellow-400" },
  initial: { dot: "bg-muted-foreground/40", line: "bg-muted-foreground/20", text: "text-muted-foreground" },
};

const StatusIcon = ({ code }: { code: number }) => {
  const status = statusColor(code);
  if (status === "delivered") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "transit") return <Truck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === "pickup") return <Package className="h-3.5 w-3.5 text-yellow-500" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />;
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export function ShippingTimeline({ data }: { data: ShippingData }) {
  const rawHistory = [...(data.history || [])].reverse(); // newest first

  // Filter to key milestones only
  const MILESTONE_NAMES = [
    "comanda trimisa la curier",
    "comandă trimisă la curier",
    "iesire din depozit",
    "ieșire din depozit",
    "in livrare la curier",
    "în livrare la curier",
    "colet livrat",
  ];
  const MILESTONE_CODES = [20800, 30500];

  const milestones = rawHistory.filter(e =>
    MILESTONE_CODES.includes(e.code) ||
    MILESTONE_NAMES.some(n => e.name.toLowerCase().includes(n))
  );

  // Deduplicate "Iesire din depozit" — keep only first (newest) occurrence
  const seen = new Set<string>();
  const history = milestones.filter(e => {
    const nameLower = e.name.toLowerCase();
    const key = nameLower.includes("iesire") || nameLower.includes("ieșire") ? "iesire" : nameLower;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const overallStatus = data.is_delivered ? "delivered" : (data.current_status ? statusColor(data.current_status.code) : "initial");

  return (
    <Card className="w-full max-w-lg border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Comanda #{data.order_id}
          </CardTitle>
          <Badge
            variant={overallStatus === "delivered" ? "default" : "secondary"}
            className={cn(
              "text-[11px]",
              overallStatus === "delivered" && "bg-green-600 hover:bg-green-700 text-white",
              overallStatus === "transit" && "bg-blue-600 hover:bg-blue-700 text-white",
              overallStatus === "pickup" && "bg-yellow-500 hover:bg-yellow-600 text-white",
            )}
          >
            {data.current_status?.name || "Necunoscut"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
          <span>AWB: <span className="font-medium text-foreground">{data.awb}</span></span>
          <span>Curier: <span className="font-medium text-foreground">{data.courier}</span></span>
          {data.service && data.service !== "Unknown" && (
            <span>Serviciu: <span className="font-medium text-foreground">{data.service}</span></span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nu există istoric de tracking disponibil.</p>
        ) : (
          <div className="relative">
            {history.map((event, i) => {
              const status = statusColor(event.code);
              const colors = colorMap[status];
              const isLast = i === history.length - 1;
              const isFirst = i === 0;

              return (
                <div key={i} className="relative flex gap-3">
                  {/* Timeline column */}
                  <div className="flex flex-col items-center w-5 shrink-0">
                    <div className={cn("h-2.5 w-2.5 rounded-full mt-1.5 ring-2 ring-background z-10", colors.dot, isFirst && "h-3 w-3")} />
                    {!isLast && <div className={cn("w-0.5 flex-1 min-h-[16px]", colors.line)} />}
                  </div>

                  {/* Content */}
                  <div className={cn("pb-4 flex-1 min-w-0", isLast && "pb-0")}>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon code={event.code} />
                      <span className={cn("text-xs font-semibold", isFirst ? "text-foreground" : colors.text)}>
                        {event.name}
                      </span>
                    </div>
                    {event.reason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{event.reason}</p>
                    )}
                    {event.comment && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3 inline shrink-0" />
                        {event.comment}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatDate(event.date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
