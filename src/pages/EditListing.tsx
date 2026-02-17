import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import RoomNumbersInput from "@/components/RoomNumbersInput";

const AMENITIES = ["WiFi", "Kitchen", "Parking", "Pool", "Air Conditioning", "Heating", "Washer", "Dryer", "TV", "Gym", "Hot Tub", "Pets Allowed"];

const EditListing = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; image_url: string }[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [roomNumbers, setRoomNumbers] = useState<string[]>([""]);
  const [existingRooms, setExistingRooms] = useState<{ id: string; room_number: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [listingRes, imagesRes, roomsRes] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).single(),
        supabase.from("listing_images").select("id, image_url").eq("listing_id", id).order("position"),
        supabase.from("rooms").select("id, room_number").eq("listing_id", id).order("room_number"),
      ]);
      if (listingRes.data) {
        const l = listingRes.data;
        setTitle(l.title);
        setDescription(l.description ?? "");
        setLocation(l.location);
        setPrice(String(l.price_per_night));
        setAmenities(l.amenities ?? []);
      }
      setExistingImages(imagesRes.data ?? []);
      const rooms = roomsRes.data ?? [];
      setExistingRooms(rooms);
      setRoomNumbers(rooms.length > 0 ? rooms.map((r) => r.room_number) : [""]);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const handleDeleteImage = async (imgId: string) => {
    await supabase.from("listing_images").delete().eq("id", imgId);
    setExistingImages((prev) => prev.filter((i) => i.id !== imgId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setSaving(true);

    const { error } = await supabase.from("listings").update({
      title, description, location, price_per_night: parseFloat(price), amenities,
    }).eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Sync rooms: delete removed, insert new
    const newRoomNumbers = roomNumbers.filter((r) => r.trim() !== "");
    const existingRoomNumbers = existingRooms.map((r) => r.room_number);
    
    // Delete rooms that were removed
    const toDelete = existingRooms.filter((r) => !newRoomNumbers.includes(r.room_number));
    for (const r of toDelete) {
      await supabase.from("rooms").delete().eq("id", r.id);
    }
    
    // Insert rooms that are new
    const toInsert = newRoomNumbers.filter((rn) => !existingRoomNumbers.includes(rn));
    if (toInsert.length > 0) {
      await supabase.from("rooms").insert(toInsert.map((rn) => ({ listing_id: id, room_number: rn })));
    }

    for (let i = 0; i < newImages.length; i++) {
      const file = newImages[i];
      const path = `${user.id}/${id}/${existingImages.length + i}-${Date.now()}`;
      const { error: upErr } = await supabase.storage.from("listing-images").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
        await supabase.from("listing_images").insert({
          listing_id: id,
          image_url: urlData.publicUrl,
          position: existingImages.length + i,
        });
      }
    }

    toast({ title: "Listing updated!" });
    navigate("/host/dashboard");
    setSaving(false);
  };

  if (loading) return <Layout><div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Edit Listing</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Night ($)</Label>
                <Input id="price" type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
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
              <RoomNumbersInput roomNumbers={roomNumbers} setRoomNumbers={setRoomNumbers} />
              <div className="space-y-2">
                <Label>Images</Label>
                <div className="flex flex-wrap gap-3">
                  {existingImages.map((img) => (
                    <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => handleDeleteImage(img.id)} className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {newImages.map((f, i) => (
                    <div key={`new-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setNewImages((prev) => prev.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setNewImages((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
                  </label>
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full" size="lg">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EditListing;
