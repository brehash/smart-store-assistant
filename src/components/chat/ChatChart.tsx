import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
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
  "hsl(262, 83%, 58%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(200, 80%, 50%)",
  "hsl(300, 60%, 50%)",
];

export function ChatChart({ chartData }: { chartData: ChartData }) {
  if (!chartData?.data?.length) return null;

  const dk = chartData.dataKey || "value";
  const nk = chartData.nameKey || "name";

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{chartData.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartData.type === "grouped_bar" && chartData.dataKeys ? (
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {chartData.dataKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : chartData.type === "bar" ? (
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey={dk} fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartData.type === "line" ? (
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey={nk} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey={dk} stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie data={chartData.data} dataKey={dk} nameKey={nk} cx="50%" cy="50%" outerRadius={80} label>
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