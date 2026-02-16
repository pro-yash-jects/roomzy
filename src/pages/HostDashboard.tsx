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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, CalendarDays, XCircle } from "lucide-react";
import { format } from "date-fns";

const HostDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [listings, setListings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"listings" | "bookings">("listings");
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string | null }>({ open: false, bookingId: null });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch listings
    const { data: listingsData } = await supabase
      .from("listings")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    setListings(listingsData ?? []);

    // Fetch bookings for host's listings (without FK join on profiles)
    const listingIds = (listingsData ?? []).map((l) => l.id);
    if (listingIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*, listings!inner(title, host_id)")
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false });

      // Fetch guest names separately
      const guestIds = [...new Set((bookingsData ?? []).map((b) => b.guest_id))];
      let guestMap: Record<string, string> = {};
      if (guestIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", guestIds);
        profiles?.forEach((p) => { guestMap[p.id] = p.full_name ?? "Unknown"; });
      }

      setBookings(
        (bookingsData ?? []).map((b) => ({
          ...b,
          guest_name: guestMap[b.guest_id] ?? "Unknown",
        }))
      );
    } else {
      setBookings([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Listing deleted" }); fetchData(); }
  };

  const handleCancel = async () => {
    if (!cancelDialog.bookingId || !cancelReason.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    setCancelling(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancellation_reason: cancelReason.trim(),
        cancelled_by: user!.id,
      })
      .eq("id", cancelDialog.bookingId);

    if (error) {
      toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking cancelled" });
      setCancelDialog({ open: false, bookingId: null });
      setCancelReason("");
      fetchData();
    }
    setCancelling(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "default";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
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
                        Guest: {b.guest_name} · <CalendarDays className="inline h-3.5 w-3.5" /> {format(new Date(b.check_in), "MMM d")} – {format(new Date(b.check_out), "MMM d, yyyy")}
                      </p>
                      {b.status === "cancelled" && b.cancellation_reason && (
                        <p className="text-xs text-destructive mt-1">Reason: {b.cancellation_reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusColor(b.status) as any}>{b.status}</Badge>
                      <span className="font-bold text-primary">${b.total_price}</span>
                      {b.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelDialog({ open: true, bookingId: b.id })}
                          title="Cancel booking"
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* Cancel booking dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => { if (!open) { setCancelDialog({ open: false, bookingId: null }); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Please provide a reason for cancelling this booking. The guest will be notified.</p>
          <Textarea
            placeholder="Reason for cancellation..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialog({ open: false, bookingId: null }); setCancelReason(""); }}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default HostDashboard;
