import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

const HostDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [listings, setListings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"listings" | "bookings">("listings");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [listingsRes, bookingsRes] = await Promise.all([
      supabase.from("listings").select("*").eq("host_id", user.id).order("created_at", { ascending: false }),
      supabase.from("bookings").select("*, listings!inner(title, host_id), profiles:guest_id(full_name)").eq("listings.host_id", user.id).order("created_at", { ascending: false }),
    ]);
    setListings(listingsRes.data ?? []);
    setBookings(bookingsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Listing deleted" }); fetchData(); }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-bold">Host Dashboard</h1>
          <Button asChild><Link to="/host/create"><Plus className="mr-1 h-4 w-4" /> New Listing</Link></Button>
        </div>

        <div className="flex gap-2 mb-6">
          <Button variant={tab === "listings" ? "default" : "outline"} size="sm" onClick={() => setTab("listings")}>My Listings</Button>
          <Button variant={tab === "bookings" ? "default" : "outline"} size="sm" onClick={() => setTab("bookings")}>Received Bookings</Button>
        </div>

        {loading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : tab === "listings" ? (
          listings.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No listings yet. Create your first one!</p>
          ) : (
            <div className="space-y-4">
              {listings.map((l) => (
                <Card key={l.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <Link to={`/listing/${l.id}`} className="font-display text-lg font-semibold hover:text-primary">{l.title}</Link>
                      <p className="text-sm text-muted-foreground">{l.location} · ${l.price_per_night}/night</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" asChild><Link to={`/host/edit/${l.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          bookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No bookings received yet.</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <Card key={b.id}>
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{b.listings?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Guest: {b.profiles?.full_name ?? "Unknown"} · <CalendarDays className="inline h-3.5 w-3.5" /> {format(new Date(b.check_in), "MMM d")} – {format(new Date(b.check_out), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge>{b.status}</Badge>
                      <span className="font-bold text-primary">${b.total_price}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
};

export default HostDashboard;
