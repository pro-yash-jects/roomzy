import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MapPin, User, CalendarDays, DoorOpen } from "lucide-react";
import ImageGallery from "@/components/ImageGallery";
import { differenceInDays, format, eachDayOfInterval } from "date-fns";
import type { DateRange } from "react-day-picker";

interface Room {
  id: string;
  room_number: string;
}

interface Booking {
  check_in: string;
  check_out: string;
  room_id: string | null;
}

const ListingDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [host, setHost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [activeImage, setActiveImage] = useState(0); // kept for compat

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [listingRes, imagesRes, roomsRes, bookingsRes] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).single(),
        supabase.from("listing_images").select("image_url").eq("listing_id", id).order("position"),
        supabase.from("rooms").select("id, room_number").eq("listing_id", id).order("room_number"),
        supabase.from("bookings").select("check_in, check_out, room_id").eq("listing_id", id).neq("status", "cancelled"),
      ]);
      if (listingRes.data) {
        setListing(listingRes.data);
        const { data: hostData } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", listingRes.data.host_id).single();
        setHost(hostData);
      }
      setImages(imagesRes.data?.map((i) => i.image_url) ?? []);
      setRooms(roomsRes.data ?? []);
      setBookings(bookingsRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const hasRooms = rooms.length > 0;

  // Compute which dates are fully booked (all rooms occupied) for the calendar
  const fullyBookedDates = (() => {
    if (!hasRooms) {
      // Legacy: no rooms, use listing-level bookings
      const dates: Date[] = [];
      bookings.forEach((b) => {
        if (!b.room_id) {
          let d = new Date(b.check_in);
          const end = new Date(b.check_out);
          while (d < end) {
            dates.push(new Date(d));
            d.setDate(d.getDate() + 1);
          }
        }
      });
      return dates;
    }
    // With rooms: a date is fully booked only when ALL rooms are booked on that date
    const dateRoomMap = new Map<string, Set<string>>();
    bookings.forEach((b) => {
      if (!b.room_id) return;
      const days = eachDayOfInterval({ start: new Date(b.check_in), end: new Date(new Date(b.check_out).getTime() - 86400000) });
      days.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        if (!dateRoomMap.has(key)) dateRoomMap.set(key, new Set());
        dateRoomMap.get(key)!.add(b.room_id!);
      });
    });
    const totalRooms = rooms.length;
    const dates: Date[] = [];
    dateRoomMap.forEach((bookedRooms, dateStr) => {
      if (bookedRooms.size >= totalRooms) {
        dates.push(new Date(dateStr));
      }
    });
    return dates;
  })();

  // Compute available rooms for the selected date range
  const availableRooms = (() => {
    if (!hasRooms || !dateRange?.from || !dateRange?.to) return rooms;
    const selectedDays = eachDayOfInterval({ start: dateRange.from, end: new Date(dateRange.to.getTime() - 86400000) });
    return rooms.filter((room) => {
      // Check if this room has any overlapping booking
      return !bookings.some((b) => {
        if (b.room_id !== room.id) return false;
        const bStart = new Date(b.check_in);
        const bEnd = new Date(b.check_out);
        return dateRange.from! < bEnd && dateRange.to! > bStart;
      });
    });
  })();

  // Reset room selection when date range changes
  useEffect(() => {
    setSelectedRoomId("");
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const nights = dateRange?.from && dateRange?.to ? differenceInDays(dateRange.to, dateRange.from) : 0;
  const totalPrice = nights * (listing?.price_per_night ?? 0);

  const canBook = nights > 0 && (!hasRooms || selectedRoomId !== "");

  const handleBook = async () => {
    if (!user) { navigate("/login"); return; }
    if (!dateRange?.from || !dateRange?.to || nights < 1) {
      toast({ title: "Select dates", description: "Pick check-in and check-out dates", variant: "destructive" });
      return;
    }
    if (hasRooms && !selectedRoomId) {
      toast({ title: "Select a room", description: "Please choose an available room", variant: "destructive" });
      return;
    }
    setBooking(true);
    const insertData: any = {
      listing_id: id!,
      guest_id: user.id,
      check_in: format(dateRange.from, "yyyy-MM-dd"),
      check_out: format(dateRange.to, "yyyy-MM-dd"),
      total_price: totalPrice,
    };
    if (hasRooms) insertData.room_id = selectedRoomId;

    const { error } = await supabase.from("bookings").insert(insertData);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
      toast({
        title: "Booking confirmed! 🎉",
        description: `${nights} night${nights > 1 ? "s" : ""} for $${totalPrice}${selectedRoom ? ` — Room ${selectedRoom.room_number}` : ""}`,
      });
      navigate("/bookings");
    }
    setBooking(false);
  };

  if (loading) return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="mb-4 h-8 w-1/3" />
        <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      </div>
    </Layout>
  );

  if (!listing) return <Layout><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Listing not found</div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold md:text-4xl">{listing.title}</h1>
        <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {listing.location}</p>

        {/* Image gallery */}
        <div className="mt-6">
          <ImageGallery images={images} alt={listing.title} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Details */}
          <div className="space-y-6">
            {host && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  {host.full_name?.[0]?.toUpperCase() ?? <User className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hosted by</p>
                  <p className="font-medium">{host.full_name || "Host"}</p>
                </div>
              </div>
            )}
            <div>
              <h2 className="font-display text-xl font-semibold mb-2">About this place</h2>
              <p className="text-muted-foreground whitespace-pre-line">{listing.description || "No description provided."}</p>
            </div>
            {listing.amenities && listing.amenities.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a: string) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
            {hasRooms && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-3">Rooms Available</h2>
                <p className="text-sm text-muted-foreground">{rooms.length} room{rooms.length > 1 ? "s" : ""} in this property</p>
              </div>
            )}
          </div>

          {/* Booking widget */}
          <Card className="sticky top-20 h-fit">
            <CardHeader>
              <CardTitle className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">${listing.price_per_night}</span>
                <span className="text-sm font-normal text-muted-foreground">/ night</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-medium"><CalendarDays className="h-4 w-4" /> Select dates</p>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  disabled={[{ before: new Date() }, ...fullyBookedDates.map((d) => d)]}
                  numberOfMonths={1}
                  className="rounded-lg border"
                  modifiers={{ booked: fullyBookedDates }}
                  modifiersClassNames={{ booked: "line-through text-destructive opacity-50" }}
                />
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-primary/20 border border-primary" /> Available</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-destructive/20 border border-destructive line-through" /> Fully Booked</span>
                </div>
              </div>

              {/* Room selection */}
              {hasRooms && nights > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-sm font-medium"><DoorOpen className="h-4 w-4" /> Select a room</p>
                  {availableRooms.length === 0 ? (
                    <p className="text-sm text-destructive">No rooms available for these dates</p>
                  ) : (
                    <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose room number" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {nights > 0 && (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>${listing.price_per_night} × {nights} nights</span><span>${totalPrice}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>${totalPrice}</span></div>
                </div>
              )}
              <Button onClick={handleBook} disabled={booking || !canBook} className="w-full" size="lg">
                {booking ? "Booking..." : !canBook ? (hasRooms && nights > 0 ? "Select a room" : "Select dates to book") : `Book — $${totalPrice}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ListingDetails;
