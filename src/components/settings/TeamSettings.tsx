import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Crown, UserPlus, Trash2, LogOut, Loader2, Mail, Send } from "lucide-react";

interface TeamData {
  team: any;
  members: any[];
  invitations: any[];
  creditBalance: any;
  userRole: string;
}

export function TeamSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("team", {
        method: "GET",
      });
      if (error) throw error;
      setTeamData(data?.team ? data : null);
    } catch (e: any) {
      console.error("Failed to load team:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("team", {
        method: "POST",
        body: { name: teamName.trim() },
      });
      if (error) throw error;
      toast({ title: "Echipă creată!", description: `„${teamName}" este gata.` });
      setTeamName("");
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Eroare", description: e.message || "Crearea echipei a eșuat", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/team/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to invite");
      toast({ title: "Invitație trimisă!", description: `Email de invitație trimis la ${inviteEmail}` });
      setInviteEmail("");
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Eroare", description: e.message || "Trimiterea invitației a eșuat", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast({ title: "Membru eliminat" });
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Eroare", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team/cancel-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invitationId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast({ title: "Invitație anulată" });
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleLeaveTeam = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast({ title: "Ai părăsit echipa" });
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteTeam = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast({ title: "Echipă ștearsă" });
      fetchTeam();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă echipa…
      </div>
    );
  }

  // No team — show create form
  if (!teamData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Echipă</h2>
          <p className="text-sm text-muted-foreground">Creează o echipă pentru a partaja credite și a colabora</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">Creează o echipă</CardTitle>
                <CardDescription>Începe o echipă pentru a invita membri și a partaja credite</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Numele echipei</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Echipa mea"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
              />
            </div>
            <Button onClick={handleCreateTeam} disabled={creating || !teamName.trim()} className="gap-1.5">
              <Users className="h-4 w-4" />
              {creating ? "Se creează…" : "Creează echipă"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = teamData.userRole === "owner";

  return (
    <div className="space-y-6">
      <div>
          <h2 className="text-lg font-semibold">Echipă</h2>
          <p className="text-sm text-muted-foreground">Gestionează membrii echipei și creditele partajate</p>
      </div>

      {/* Team info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">{teamData.team.name}</CardTitle>
                <CardDescription>{teamData.members.length} membr{teamData.members.length !== 1 ? "i" : "u"}</CardDescription>
              </div>
            </div>
            <Badge variant={isOwner ? "default" : "secondary"}>
              {isOwner ? <><Crown className="h-3 w-3 mr-1" />Proprietar</> : "Membru"}
            </Badge>
          </div>
        </CardHeader>

        {/* Shared credits */}
        {teamData.creditBalance && (
          <CardContent className="pt-0 pb-4">
            <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Sold credite partajate</p>
              <p className="text-2xl font-bold text-primary">{teamData.creditBalance.balance}</p>
              <p className="text-xs text-muted-foreground">
                Alocație lunară: {teamData.creditBalance.monthly_allowance}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamData.members.map((member: any) => (
            <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(member.display_name || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.display_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.role === "owner" && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Crown className="h-3 w-3" />Owner
                  </Badge>
                )}
                {isOwner && member.user_id !== user?.id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {member.display_name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          They will lose access to the shared credit balance.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemoveMember(member.user_id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {teamData.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamData.invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted p-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(inv.id)}
                    className="text-destructive hover:text-destructive text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite form (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><UserPlus className="h-5 w-5 text-primary" /></div>
              <div>
                <CardTitle className="text-base">Invite Member</CardTitle>
                <CardDescription>Send an invitation email to add a team member</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                type="email"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-1.5">
                <Send className="h-4 w-4" />
                {inviting ? "Sending…" : "Invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          {isOwner ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-1.5">
                  <Trash2 className="h-4 w-4" /> Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete team?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all members and unlink shared credits. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTeam}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive">
                  <LogOut className="h-4 w-4" /> Leave Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave team?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will lose access to the shared credit balance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeaveTeam}>Leave</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
