import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatChart } from "./ChatChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string;
  change?: string;
}

interface CellWithUrl {
  text: string;
  url?: string;
}

type CellValue = string | number | null | CellWithUrl;

interface DashboardTable {
  title: string;
  columns: string[];
  rows: Array<Array<CellValue>>;
}

interface DashboardList {
  title: string;
  items: string[];
  collapsible?: boolean;
}

export interface DashboardData {
  cards?: StatCard[];
  charts?: any[];
  tables?: DashboardTable[];
  lists?: DashboardList[];
}

export function DashboardView({ data }: { data: DashboardData }) {
  if (!data) return null;

  return (
    <div className="w-full max-w-5xl space-y-4">
      {data.cards && data.cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.cards.map((card, i) => {
            const negative = card.change?.trim().startsWith("-");

            return (
              <Card key={i} className="p-4">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
                {card.change && (
                  <div className={cn(
                    "mt-3 flex items-center gap-1 text-sm",
                    negative ? "text-destructive" : "text-primary",
                  )}>
                    {negative ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                    <span>{card.change}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {data.charts?.map((chart, i) => (
        <ChatChart key={`chart-${i}`} chartData={chart} />
      ))}

      {data.tables?.map((table, i) => (
        <Card key={`table-${i}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">{table.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.columns.map((col, ci) => (
                      <TableHead key={ci} className="min-w-[140px] align-top text-xs sm:text-sm whitespace-normal">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="min-w-[140px] py-3 text-xs sm:text-sm align-top whitespace-normal">
                          <CellRenderer cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {data.lists?.map((list, i) => (
        <CollapsibleList key={`list-${i}`} list={list} />
      ))}
    </div>
  );
}

function CollapsibleList({ list }: { list: DashboardList }) {
  const [open, setOpen] = useState(!list.collapsible);

  return (
    <Card>
      <button
        onClick={() => list.collapsible && setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-4 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          list.collapsible && "cursor-pointer hover:bg-accent/50",
        )}
      >
        {list.collapsible && (
          open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span>{list.title}</span>
      </button>
      {open && (
        <CardContent className="pt-0">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {list.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="mt-1 text-muted-foreground/50">•</span>
                <span className="whitespace-pre-wrap">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
