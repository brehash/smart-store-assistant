import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatChart } from "./ChatChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string;
  change?: string;
}

interface DashboardTable {
  title: string;
  columns: string[];
  rows: string[][];
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
    <div className="w-full space-y-3">
      {/* Stat cards */}
      {data.cards && data.cards.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.cards.map((card, i) => (
            <Card key={i} className="p-3">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-bold mt-0.5">{card.value}</p>
              {card.change && (
                <div className={cn(
                  "flex items-center gap-1 text-xs mt-1",
                  card.change.startsWith("-") ? "text-destructive" : "text-green-600 dark:text-green-400"
                )}>
                  {card.change.startsWith("-")
                    ? <TrendingDown className="h-3 w-3" />
                    : <TrendingUp className="h-3 w-3" />
                  }
                  {card.change}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {data.charts?.map((chart, i) => (
        <ChatChart key={`chart-${i}`} chartData={chart} />
      ))}

      {/* Tables */}
      {data.tables?.map((table, i) => (
        <Card key={`table-${i}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{table.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((col, ci) => (
                    <TableHead key={ci} className="text-xs">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, ri) => (
                  <TableRow key={ri}>
                    {row.map((cell, ci) => (
                      <TableCell key={ci} className="text-xs py-2">{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Lists */}
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
          "flex w-full items-center gap-2 px-4 py-3 text-sm font-medium",
          list.collapsible && "cursor-pointer hover:bg-accent/50"
        )}
      >
        {list.collapsible && (
          open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        )}
        {list.title}
      </button>
      {open && (
        <CardContent className="pt-0">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {list.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground/50 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
