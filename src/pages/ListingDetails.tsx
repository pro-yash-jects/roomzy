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
import { useToast } from "@/hooks/use-toast";
import { MapPin, User, CalendarDays } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";

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
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [listingRes, imagesRes] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).single(),
        supabase.from("listing_images").select("image_url").eq("listing_id", id).order("position"),
      ]);
      if (listingRes.data) {
        setListing(listingRes.data);
        const { data: hostData } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", listingRes.data.host_id).single();
        setHost(hostData);
      }
      setImages(imagesRes.data?.map((i) => i.image_url) ?? []);

      // fetch booked dates
      const { data: bookings } = await supabase
        .from("bookings")
        .select("check_in, check_out")
        .eq("listing_id", id)
        .neq("status", "cancelled");
      const dates: Date[] = [];
      bookings?.forEach((b) => {
        let d = new Date(b.check_in);
        const end = new Date(b.check_out);
        while (d < end) {
          dates.push(new Date(d));
          d.setDate(d.getDate() + 1);
        }
      });
      setBookedDates(dates);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const nights = dateRange?.from && dateRange?.to ? differenceInDays(dateRange.to, dateRange.from) : 0;
  const totalPrice = nights * (listing?.price_per_night ?? 0);

  const handleBook = async () => {
    if (!user) { navigate("/login"); return; }
    if (!dateRange?.from || !dateRange?.to || nights < 1) {
      toast({ title: "Select dates", description: "Pick check-in and check-out dates", variant: "destructive" });
      return;
    }
    setBooking(true);
    const { error } = await supabase.from("bookings").insert({
      listing_id: id!,
      guest_id: user.id,
      check_in: format(dateRange.from, "yyyy-MM-dd"),
      check_out: format(dateRange.to, "yyyy-MM-dd"),
      total_price: totalPrice,
    });
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking confirmed! 🎉", description: `${nights} night${nights > 1 ? "s" : ""} for $${totalPrice}` });
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
        <div className="mt-6 grid gap-2 md:grid-cols-[2fr_1fr]">
          <div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No images</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              {images.slice(0, 3).map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={`aspect-[4/3] overflow-hidden rounded-lg border-2 ${activeImage === i ? "border-primary" : "border-transparent"}`}>
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
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
                  disabled={[{ before: new Date() }, ...bookedDates.map((d) => d)]}
                  numberOfMonths={1}
                  className="rounded-lg border"
                  modifiers={{ booked: bookedDates }}
                  modifiersClassNames={{ booked: "line-through text-destructive opacity-50" }}
                />
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-primary/20 border border-primary" /> Available</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-destructive/20 border border-destructive line-through" /> Booked</span>
                </div>
              </div>
              {nights > 0 && (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between"><span>${listing.price_per_night} × {nights} nights</span><span>${totalPrice}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>${totalPrice}</span></div>
                </div>
              )}
              <Button onClick={handleBook} disabled={booking || nights < 1} className="w-full" size="lg">
                {booking ? "Booking..." : nights < 1 ? "Select dates to book" : `Book — $${totalPrice}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ListingDetails;
