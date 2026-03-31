import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, FileSearch } from "lucide-react";

export interface GeoCategory {
  name: string;
  score: number;
  maxScore: number;
  details?: string;
}

export interface GeoRecommendation {
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface GeoBulkItem {
  id: number;
  name: string;
  score: number;
  topIssue: string;
  type: string;
}

export interface GeoReportData {
  mode?: "single" | "bulk";
  // Single mode
  entityName?: string;
  entityType?: string;
  entityId?: number;
  score?: number;
  categories?: GeoCategory[];
  recommendations?: GeoRecommendation[];
  // Bulk mode
  items?: GeoBulkItem[];
  averageScore?: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-yellow-500";
  return "text-destructive";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-destructive";
}

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          className={cn(
            score >= 70 ? "stroke-green-500" : score >= 40 ? "stroke-yellow-500" : "stroke-destructive"
          )}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className={cn("absolute text-2xl font-bold", scoreColor(score))}>{score}</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variant = priority === "high" ? "destructive" : priority === "medium" ? "secondary" : "outline";
  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{priority}</Badge>;
}

export function GeoReportCard({ data }: { data: GeoReportData }) {
  if (data.mode === "bulk" && data.items?.length) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            GEO Bulk Audit — {data.items.length} items
            {data.averageScore != null && (
              <Badge variant="outline" className={cn("ml-auto", scoreColor(data.averageScore))}>
                Avg: {data.averageScore}/100
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead className="w-[60px]">Tip</TableHead>
                <TableHead className="w-[70px]">Scor</TableHead>
                <TableHead>Problema principală</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.sort((a, b) => a.score - b.score).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-xs">{item.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{item.type}</Badge></TableCell>
                  <TableCell>
                    <span className={cn("font-bold text-sm", scoreColor(item.score))}>{item.score}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.topIssue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  // Single mode
  const score = data.score ?? 0;
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSearch className="h-4 w-4" />
          GEO Audit: {data.entityName || "Unknown"}
          <Badge variant="outline" className="ml-1 text-[10px]">{data.entityType || "product"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Score circle */}
        <div className="flex items-center gap-6">
          <ScoreCircle score={score} />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-medium">
              {score >= 70 ? "Bună" : score >= 40 ? "Necesită îmbunătățiri" : "Slabă"} pregătire GEO
            </p>
            <p className="text-xs text-muted-foreground">
              {score >= 70
                ? "Acest conținut este bine optimizat pentru motoarele de căutare AI."
                : score >= 40
                  ? "Sunt necesare unele îmbunătățiri pentru a se clasa bine în căutarea AI."
                  : "Optimizare semnificativă necesară pentru vizibilitatea în căutarea AI."}
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        {data.categories && data.categories.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categorii</p>
            {data.categories.map((cat) => {
              const pct = Math.round((cat.score / cat.maxScore) * 100);
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{cat.name}</span>
                    <span className={scoreColor(pct)}>{cat.score}/{cat.maxScore}</span>
                  </div>
                  <Progress value={pct} className={cn("h-1.5 [&>div]:transition-all", `[&>div]:${scoreBg(pct)}`)} />
                </div>
              );
            })}
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recomandări</p>
            <ul className="space-y-1.5">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {rec.priority === "high" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  ) : rec.priority === "medium" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1">{rec.text}</span>
                  <PriorityBadge priority={rec.priority} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
