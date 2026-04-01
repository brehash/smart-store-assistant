import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";

interface Stats {
  total_users: number;
  total_messages: number;
  total_conversations: number;
  token_usage_7d: { name: string; value: number }[];
}

interface Props {
  accessToken: string;
}

export function UsageStats({ accessToken }: Props) {
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/stats`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (resp.ok) return resp.json() as Promise<Stats>;
      return null;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!stats) return <p className="text-muted-foreground">Failed to load stats.</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums">{stats.total_users.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Messages</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums">{stats.total_messages.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Conversations</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold tabular-nums">{stats.total_conversations.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {stats.token_usage_7d.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Token Usage (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.token_usage_7d}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
