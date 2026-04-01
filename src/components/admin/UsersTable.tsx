import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, Shield, ShieldOff, UserPlus, Loader2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { saveAdminSession, startImpersonation } from "./ImpersonationBanner";
import type { AdminUser } from "@/pages/Admin";

interface Props {
  users: AdminUser[];
  loading: boolean;
  onSelectUser: (user: AdminUser) => void;
  onRefresh: () => void;
  accessToken: string;
}

export function UsersTable({ users, loading, onSelectUser, onRefresh, accessToken }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

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

  const handleImpersonate = async (user: AdminUser, e: React.MouseEvent) => {
    e.stopPropagation();
    setImpersonating(user.user_id);
    try {
      // Save current admin session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;
      saveAdminSession(currentSession.access_token, currentSession.refresh_token);

      // Get impersonation token
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users/${user.user_id}/impersonate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Error", description: data.error || "Failed to impersonate", variant: "destructive" });
        return;
      }

      // Sign in as the target user using the magic link token
      const { error: otpErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: data.token_hash,
      });
      if (otpErr) {
        toast({ title: "Error", description: otpErr.message, variant: "destructive" });
        sessionStorage.removeItem("admin_session");
        return;
      }

      startImpersonation(data.display_name || user.display_name || "Unknown");
      navigate("/");
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
      sessionStorage.removeItem("admin_session");
    } finally {
      setImpersonating(null);
    }
  };

  const handleCreate = async () => {
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: newEmail, password: newPassword, display_name: newDisplayName || undefined }),
        }
      );
      const data = await resp.json();
      if (resp.ok) {
        toast({ title: "User created", description: `${newEmail} has been created.` });
        setCreateOpen(false);
        setNewEmail("");
        setNewPassword("");
        setNewDisplayName("");
        onRefresh();
      } else {
        toast({ title: "Error", description: data.error || "Failed to create user.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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
      <div className="flex justify-between">
        <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Create User
        </Button>
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
                <TableCell className="text-right flex gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleImpersonate(user, e)}
                    title="Impersonate user"
                    disabled={impersonating === user.user_id}
                  >
                    {impersonating === user.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => toggleAdmin(user, e)} title={user.roles.includes("admin") ? "Remove admin" : "Make admin"}>
                    {user.roles.includes("admin") ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newEmail || !newPassword}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
