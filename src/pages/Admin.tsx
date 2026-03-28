import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UsersTable } from "@/components/admin/UsersTable";
import { UserDetail } from "@/components/admin/UserDetail";
import { UsageStats } from "@/components/admin/UsageStats";
import { PlansManager } from "@/components/admin/PlansManager";

export interface AdminUser {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  message_count: number;
  total_tokens: number;
  limits: { daily_limit: number; monthly_limit: number } | null;
  roles: string[];
}

export default function Admin() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const fetchUsers = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/users`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [session]);

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-background p-6">
        <UserDetail
          user={selectedUser}
          accessToken={session?.access_token || ""}
          onBack={() => { setSelectedUser(null); fetchUsers(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="stats">Usage Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <UsersTable
              users={users}
              loading={loading}
              onSelectUser={setSelectedUser}
              onRefresh={fetchUsers}
              accessToken={session?.access_token || ""}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <UsageStats accessToken={session?.access_token || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
