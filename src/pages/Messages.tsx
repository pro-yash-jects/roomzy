import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import ChatWindow from "@/components/ChatWindow";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  updated_at: string;
  listing_title?: string;
  other_user?: { id: string; full_name: string | null; avatar_url: string | null };
}

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("conversation"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      // Enrich with listing titles and other user profiles
      const enriched = await Promise.all(
        data.map(async (c) => {
          const otherId = c.guest_id === user.id ? c.host_id : c.guest_id;
          const [listingRes, profileRes] = await Promise.all([
            supabase.from("listings").select("title").eq("id", c.listing_id).single(),
            supabase.from("profiles").select("full_name, avatar_url").eq("id", otherId).single(),
          ]);
          return {
            ...c,
            listing_title: listingRes.data?.title ?? "Unknown listing",
            other_user: { id: otherId, ...(profileRes.data ?? { full_name: null, avatar_url: null }) },
          };
        })
      );

      setConversations(enriched);
      if (!selectedId && enriched.length > 0) {
        setSelectedId(searchParams.get("conversation") || enriched[0].id);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const selected = conversations.find((c) => c.id === selectedId);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-10 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold mb-4">Messages</h1>
        {conversations.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageSquare className="mx-auto h-12 w-12 mb-3 opacity-40" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-200px)]">
            {/* Sidebar */}
            <Card className="overflow-auto">
              {conversations.map((c) => {
                const initials = c.other_user?.full_name
                  ? c.other_user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "U";
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left border-b transition-colors hover:bg-muted/50 ${
                      selectedId === c.id ? "bg-muted" : ""
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={c.other_user?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{c.other_user?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.listing_title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </span>
                  </button>
                );
              })}
            </Card>

            {/* Chat area */}
            <Card className="flex flex-col overflow-hidden">
              {selected ? (
                <>
                  <div className="border-b p-3 flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selected.other_user?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                        {selected.other_user?.full_name?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selected.other_user?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{selected.listing_title}</p>
                    </div>
                  </div>
                  <ChatWindow
                    key={selected.id}
                    conversationId={selected.id}
                    otherUser={selected.other_user!}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a conversation
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Messages;
