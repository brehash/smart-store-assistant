import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Plus, MessageSquare, Settings, LogOut, Trash2,
  FolderOpen, ChevronDown, ChevronRight, FolderPlus,
  Pencil, X, Check, Search, MoreHorizontal, Pin,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  view_id: string | null;
  pinned: boolean;
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
  onNewInView?: (viewId: string) => void;
  onViewIdChange?: (viewId: string | null) => void;
}

export function ConversationSidebar({ activeId, onSelect, onNew, onNewInView, onViewIdChange }: ConversationSidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState("");
  const [viewsLimit, setViewsLimit] = useState(5);
  const [recentsLimit, setRecentsLimit] = useState(10);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [convRes, viewRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, title, updated_at, view_id, pinned")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("views")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (convRes.data) setConversations(convRes.data as unknown as Conversation[]);
      if (viewRes.data) setViews(viewRes.data as unknown as View[]);
    };
    load();
  }, [user, activeId]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const ungroupedConversations = useMemo(() => {
    const ungrouped = filteredConversations.filter((c) => !c.view_id);
    // Pinned first, then by updated_at
    return ungrouped.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [filteredConversations]);

  const getViewConversations = (viewId: string) => filteredConversations.filter((c) => c.view_id === viewId);

  // Handlers
  const handleDelete = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) onNew();
  };

  const handleRenameConv = async (id: string) => {
    if (!editingConvTitle.trim()) return;
    await supabase.from("conversations").update({ title: editingConvTitle.trim() }).eq("id", id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: editingConvTitle.trim() } : c)));
    setEditingConvId(null);
  };

  const handleTogglePin = async (conv: Conversation) => {
    const newPinned = !conv.pinned;
    await supabase.from("conversations").update({ pinned: newPinned } as any).eq("id", conv.id);
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, pinned: newPinned } : c)));
  };

  const handleMoveToView = async (convId: string, viewId: string | null) => {
    await supabase.from("conversations").update({ view_id: viewId }).eq("id", convId);
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, view_id: viewId } : c)));
  };

  const handleCreateView = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("views")
      .insert({ user_id: user.id, name: "New View" })
      .select()
      .single();
    if (data) {
      setViews((prev) => [data as unknown as View, ...prev]);
      setExpandedViews((prev) => new Set(prev).add(data.id));
      setEditingViewId(data.id);
      setEditingName((data as any).name);
    }
  };

  const handleRenameView = async (viewId: string) => {
    if (!editingName.trim()) return;
    await supabase.from("views").update({ name: editingName.trim() }).eq("id", viewId);
    setViews((prev) => prev.map((v) => (v.id === viewId ? { ...v, name: editingName.trim() } : v)));
    setEditingViewId(null);
  };

  const handleDeleteView = async (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    await supabase.from("views").delete().eq("id", viewId);
    setViews((prev) => prev.filter((v) => v.id !== viewId));
    setConversations((prev) => prev.map((c) => (c.view_id === viewId ? { ...c, view_id: null } : c)));
  };

  const toggleView = (viewId: string) => {
    setExpandedViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewId)) next.delete(viewId);
      else next.add(viewId);
      return next;
    });
  };

  // Render a single conversation item with context menu
  const renderConversation = (c: Conversation) => {
    const showMenu = hoveredConvId === c.id || openMenuConvId === c.id;
    return (
      <div
        key={c.id}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
          activeId === c.id
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
        )}
        onClick={() => onSelect(c.id, c.view_id)}
        onMouseEnter={() => setHoveredConvId(c.id)}
        onMouseLeave={() => setHoveredConvId(null)}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />

        {editingConvId === c.id ? (
          <Input
            value={editingConvTitle}
            onChange={(e) => setEditingConvTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameConv(c.id);
              if (e.key === "Escape") setEditingConvId(null);
            }}
            onBlur={() => handleRenameConv(c.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-5 text-xs bg-sidebar-accent border-sidebar-border px-1 flex-1"
            autoFocus
          />
        ) : (
          <span className="truncate flex-1">{c.title}</span>
        )}

        {c.pinned && !showMenu && editingConvId !== c.id && (
          <Pin className="h-3 w-3 shrink-0 rotate-45 text-sidebar-foreground/50" />
        )}

        {showMenu && editingConvId !== c.id && (
          <DropdownMenu onOpenChange={(open) => setOpenMenuConvId(open ? c.id : null)}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 h-5 w-5 flex items-center justify-center hover:text-sidebar-foreground rounded hover:bg-sidebar-accent"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingConvId(c.id); setEditingConvTitle(c.title); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Move to view
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {c.view_id && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToView(c.id, null); }}>
                      <X className="h-3.5 w-3.5 mr-2" /> Remove from view
                    </DropdownMenuItem>
                  )}
                  {views.map((v) => (
                    <DropdownMenuItem key={v.id} onClick={(e) => { e.stopPropagation(); handleMoveToView(c.id, v.id); }}>
                      <FolderOpen className="h-3.5 w-3.5 mr-2" /> {v.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleTogglePin(c); }}>
                <Pin className="h-3.5 w-3.5 mr-2 rotate-45" /> {c.pinned ? "Unpin chat" : "Pin chat"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const visibleViews = views.slice(0, viewsLimit);
  const visibleRecents = ungroupedConversations.slice(0, recentsLimit);

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* New Chat */}
      <div className="p-3 pb-2">
        <Button onClick={onNew} className="w-full gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <Plus className="h-4 w-4" /> New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="h-8 pl-8 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-4">
          {/* Views Section */}
          <div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Views</span>
              <button onClick={handleCreateView} className="p-1 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors" title="New View">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {visibleViews.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-sidebar-foreground/30">No views yet</p>
              )}
              {visibleViews.map((view) => {
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameView(view.id);
                              if (e.key === "Escape") setEditingViewId(null);
                            }}
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
                        {/* New Chat inside view */}
                        <button
                          onClick={() => onNewInView?.(view.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors"
                        >
                          <Plus className="h-3 w-3" /> New Chat
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {views.length > viewsLimit && (
                <button
                  onClick={() => setViewsLimit((prev) => prev + 5)}
                  className="w-full px-3 py-1.5 text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors text-center"
                >
                  Show more views
                </button>
              )}
            </div>
          </div>

          {/* Recents Section */}
          <div>
            <div className="px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Recents</span>
            </div>
            <div className="space-y-0.5">
              {visibleRecents.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-sidebar-foreground/30">No chats yet</p>
              )}
              {visibleRecents.map(renderConversation)}
              {ungroupedConversations.length > recentsLimit && (
                <button
                  onClick={() => setRecentsLimit((prev) => prev + 10)}
                  className="w-full px-3 py-1.5 text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors text-center"
                >
                  Show more chats
                </button>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <button onClick={() => navigate("/settings")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
