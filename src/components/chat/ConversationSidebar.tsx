import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Settings, LogOut, Trash2, FolderOpen, ChevronDown, ChevronRight, FolderPlus, Pencil, X, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  view_id: string | null;
}

interface View {
  id: string;
  name: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  activeId: string | null;
  onSelect: (id: string, viewId?: string | null) => void;
  onNew: () => void;
  onViewIdChange?: (viewId: string | null) => void;
}

export function ConversationSidebar({ activeId, onSelect, onNew, onViewIdChange }: ConversationSidebarProps) {
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [convRes, viewRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, title, updated_at, view_id" as any)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        (supabase as any)
          .from("views")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (convRes.data) setConversations(convRes.data as unknown as Conversation[]);
      if (viewRes.data) setViews(viewRes.data as View[]);
    };
    load();
  }, [user, activeId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) onNew();
  };

  const handleCreateView = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("views")
      .insert({ user_id: user.id, name: "New View" })
      .select()
      .single();
    if (data) {
      setViews((prev) => [data as View, ...prev]);
      setExpandedViews((prev) => new Set(prev).add(data.id));
      setEditingViewId(data.id);
      setEditingName(data.name);
    }
  };

  const handleRenameView = async (viewId: string) => {
    if (!editingName.trim()) return;
    await (supabase as any).from("views").update({ name: editingName.trim() }).eq("id", viewId);
    setViews((prev) => prev.map((v) => v.id === viewId ? { ...v, name: editingName.trim() } : v));
    setEditingViewId(null);
  };

  const handleDeleteView = async (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    await (supabase as any).from("views").delete().eq("id", viewId);
    setViews((prev) => prev.filter((v) => v.id !== viewId));
    setConversations((prev) => prev.map((c) => c.view_id === viewId ? { ...c, view_id: null } : c));
  };

  const handleMoveToView = async (convId: string, viewId: string | null) => {
    await supabase.from("conversations").update({ view_id: viewId } as any).eq("id", convId);
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, view_id: viewId } : c));
    if (convId === activeId) onViewIdChange?.(viewId);
  };

  const toggleView = (viewId: string) => {
    setExpandedViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) next.delete(viewId); else next.add(viewId);
      return next;
    });
  };

  const ungroupedConversations = conversations.filter((c) => !c.view_id);
  const getViewConversations = (viewId: string) => conversations.filter((c) => c.view_id === viewId);

  const renderConversation = (c: Conversation) => (
    <button
      key={c.id}
      onClick={() => onSelect(c.id, c.view_id)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        activeId === c.id
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate flex-1">{c.title}</span>
      <button
        onClick={(e) => handleDelete(e, c.id)}
        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </button>
  );

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4 space-y-2">
        <Button onClick={onNew} className="w-full gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <Plus className="h-4 w-4" /> New Chat
        </Button>
        <Button onClick={handleCreateView} variant="outline" size="sm" className="w-full gap-2 text-xs border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent/50">
          <FolderPlus className="h-3.5 w-3.5" /> New View
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1">
          {/* Views */}
          {views.map((view) => {
            const viewConvs = getViewConversations(view.id);
            const isExpanded = expandedViews.has(view.id);
            return (
              <div key={view.id}>
                <div className="group flex items-center gap-1">
                  <button
                    onClick={() => toggleView(view.id)}
                    className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/30 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <FolderOpen className="h-3.5 w-3.5" />
                    {editingViewId === view.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameView(view.id); if (e.key === "Escape") setEditingViewId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 text-xs bg-sidebar-accent border-sidebar-border px-1"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate">{view.name}</span>
                    )}
                    <span className="text-[10px] text-sidebar-foreground/40 ml-auto">{viewConvs.length}</span>
                  </button>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingViewId === view.id ? (
                      <>
                        <button onClick={() => handleRenameView(view.id)} className="p-0.5 hover:text-primary"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditingViewId(null)} className="p-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingViewId(view.id); setEditingName(view.name); }} className="p-0.5 hover:text-primary"><Pencil className="h-3 w-3" /></button>
                        <button onClick={(e) => handleDeleteView(e, view.id)} className="p-0.5 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {viewConvs.length === 0 && (
                      <p className="text-[10px] text-sidebar-foreground/30 px-3 py-1">No chats yet</p>
                    )}
                    {viewConvs.map(renderConversation)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped conversations */}
          {views.length > 0 && ungroupedConversations.length > 0 && (
            <div className="pt-2">
              <p className="px-3 py-1 text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">Chats</p>
            </div>
          )}
          {ungroupedConversations.map(renderConversation)}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
