import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ListingCard from "@/components/ListingCard";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";

interface ListingWithImage {
  id: string;
  title: string;
  location: string;
  price_per_night: number;
  image_url?: string;
}

const Index = () => {
  const [listings, setListings] = useState<ListingWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [showRoomzy, setShowRoomzy] = useState(true);

  useEffect(() => {
    const cycle = () => {
      setShowRoomzy(true);
      const timer = setTimeout(() => setShowRoomzy(false), 1000);
      return timer;
    };
    const t = cycle();
    const interval = setInterval(cycle, 10000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      const { data: listingsData } = await supabase
        .from("listings")
        .select("id, title, location, price_per_night")
        .eq("is_listed", true)
        .order("created_at", { ascending: false });

      if (!listingsData) { setLoading(false); return; }

      const ids = listingsData.map((l) => l.id);
      const { data: images } = await supabase
        .from("listing_images")
        .select("listing_id, image_url")
        .in("listing_id", ids)
        .order("position", { ascending: true });

      const imageMap = new Map<string, string>();
      images?.forEach((img) => {
        if (!imageMap.has(img.listing_id)) imageMap.set(img.listing_id, img.image_url);
      });

      setListings(listingsData.map((l) => ({ ...l, image_url: imageMap.get(l.id) })));
      setLoading(false);
    };
    fetchListings();
  }, []);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesSearch = !debouncedSearch || l.location.toLowerCase().includes(debouncedSearch.toLowerCase()) || l.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesPrice = l.price_per_night >= priceRange[0] && l.price_per_night <= priceRange[1];
      return matchesSearch && matchesPrice;
    });
  }, [listings, debouncedSearch, priceRange]);

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl font-bold md:text-5xl lg:text-6xl h-[1.2em] relative overflow-hidden">
            <AnimatePresence mode="wait">
              {showRoomzy ? (
                <motion.span
                  key="roomzy"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="block text-primary"
                >
                  Roomzy
                </motion.span>
              ) : (
                <motion.span
                  key="tagline"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="block"
                >
                  Find Your Perfect <span className="text-primary">Stay</span>
                </motion.span>
              )}
            </AnimatePresence>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Discover unique homes and experiences around the world
          </p>
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl border bg-card p-2 shadow-md">
            <Search className="ml-2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by location or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </section>

      {/* Filters + Listings */}
      <section className="container mx-auto px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl font-semibold">Featured Stays</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">${priceRange[0]} – ${priceRange[1]}/night</span>
            <Slider
              min={0}
              max={1000}
              step={10}
              value={priceRange}
              onValueChange={setPriceRange}
              className="w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg">No listings found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} {...listing} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Index;
