import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Shield, ShieldOff } from "lucide-react";
import type { AdminUser } from "@/pages/Admin";

interface Props {
  users: AdminUser[];
  loading: boolean;
  onSelectUser: (user: AdminUser) => void;
  onRefresh: () => void;
  accessToken: string;
}

export function UsersTable({ users, loading, onSelectUser, onRefresh, accessToken }: Props) {
  const toggleAdmin = async (user: AdminUser, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAdmin = user.roles.includes("admin");
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/role`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin", action: isAdmin ? "remove" : "add" }),
      }
    );
    onRefresh();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Messages</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Daily Limit</TableHead>
              <TableHead className="text-right">Monthly Limit</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.user_id}
                className="cursor-pointer"
                onClick={() => onSelectUser(user)}
              >
                <TableCell className="font-medium">
                  {user.display_name || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{user.message_count.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{user.total_tokens.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{user.limits?.daily_limit ?? "∞"}</TableCell>
                <TableCell className="text-right tabular-nums">{user.limits?.monthly_limit ?? "∞"}</TableCell>
                <TableCell>
                  {user.roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="mr-1">
                      {r}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={(e) => toggleAdmin(user, e)} title={user.roles.includes("admin") ? "Remove admin" : "Make admin"}>
                    {user.roles.includes("admin") ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
