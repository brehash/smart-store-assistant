import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartData {
  type: "bar" | "line" | "pie";
  title: string;
  data: any[];
  dataKey?: string;
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
            {chartData.type === "bar" ? (
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
