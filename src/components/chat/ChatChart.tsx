import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartData {
  type: "bar" | "line" | "pie" | "grouped_bar";
  title: string;
  data: any[];
  dataKey?: string;
  dataKeys?: string[];
  nameKey?: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
];

export function ChatChart({ chartData }: { chartData: ChartData }) {
  if (!chartData?.data?.length) return null;

  const dk = chartData.dataKey || "value";
  const nk = chartData.nameKey || "name";
  const numericValues = chartData.data.map((item) => Number(item?.[dk] ?? 0));
  const maxValue = Math.max(...numericValues, 0);
  const showLineDots = chartData.data.length <= 2 || maxValue === 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{chartData.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartData.type === "grouped_bar" && chartData.dataKeys ? (
              <BarChart data={chartData.data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.35} />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} tickMargin={8} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Legend />
                {chartData.dataKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : chartData.type === "bar" ? (
              <BarChart data={chartData.data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.35} />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} tickMargin={8} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey={dk} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartData.type === "line" ? (
              <LineChart data={chartData.data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.35} />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} tickMargin={8} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, maxValue === 0 ? 1 : maxValue]} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Line
                  type="monotone"
                  dataKey={dk}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={showLineDots ? { r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--primary))" } : false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                  connectNulls
                />
              </LineChart>
            ) : (
              <PieChart>
                <Pie data={chartData.data} dataKey={dk} nameKey={nk} cx="50%" cy="50%" outerRadius={88} label>
                  {chartData.data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
