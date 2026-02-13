import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

const AMENITIES = ["WiFi", "Kitchen", "Parking", "Pool", "Air Conditioning", "Heating", "Washer", "Dryer", "TV", "Gym", "Hot Tub", "Pets Allowed"];

const CreateListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { data: listing, error } = await supabase.from("listings").insert({
      host_id: user.id,
      title,
      description,
      location,
      price_per_night: parseFloat(price),
      amenities,
    }).select().single();

    if (error || !listing) {
      toast({ title: "Error", description: error?.message ?? "Failed to create listing", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Upload images
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const path = `${user.id}/${listing.id}/${i}-${Date.now()}`;
      const { error: upErr } = await supabase.storage.from("listing-images").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
        await supabase.from("listing_images").insert({
          listing_id: listing.id,
          image_url: urlData.publicUrl,
          position: i,
        });
      }
    }

    toast({ title: "Listing created! 🎉" });
    navigate("/host/dashboard");
    setSaving(false);
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Create New Listing</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Cozy Beach Cottage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="Malibu, California" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Night ($)</Label>
                <Input id="price" type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="99" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe your property..." />
              </div>
              <div className="space-y-2">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMENITIES.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={amenities.includes(a)} onCheckedChange={() => toggleAmenity(a)} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Images</Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((f, i) => (
                    <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
                  </label>
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full" size="lg">
                {saving ? "Creating..." : "Create Listing"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateListing;
