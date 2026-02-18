import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Mail, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Deletion flow state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url);
      }
    });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id);
      toast({ title: "Avatar updated!" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, bio }).eq("id", user.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Profile updated!" });
    setSaving(false);
  };

  const handleSendOtp = async () => {
    if (!user?.email) return;
    setSendingOtp(true);
    // Use reauthenticate() which sends a visible 6-digit code in the email
    const { error } = await supabase.auth.reauthenticate();
    setSendingOtp(false);
    if (error) {
      toast({ title: "Failed to send code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Verification code sent", description: `Check your email at ${user.email}` });
    setConfirmDialogOpen(false);
    setOtpDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user?.email || otpValue.length < 8) return;
    setDeleting(true);
    // Verify the reauthentication nonce via updateUser
    const { error: verifyError } = await supabase.auth.updateUser({
      data: { _deletion_verified: true },
      nonce: otpValue,
    });
    if (verifyError) {
      setDeleting(false);
      toast({ title: "Invalid code", description: "The verification code is incorrect or expired.", variant: "destructive" });
      return;
    }
    // Nonce verified, now delete the account
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("delete-account", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setDeleting(false);
    setOtpDialogOpen(false);
    if (res.error) {
      toast({ title: "Error", description: "Failed to delete account. Please try again.", variant: "destructive" });
    } else {
      await signOut();
      navigate("/");
      toast({ title: "Account deleted", description: "Your account has been permanently removed." });
    }
  };

  const initials = fullName ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <Layout>
      <div className="container mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar" className="cursor-pointer text-sm text-primary hover:underline">
                {uploading ? "Uploading..." : "Change avatar"}
              </Label>
              <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>

            <Button variant="destructive" className="w-full" onClick={() => setConfirmDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Account
            </Button>

            {/* Confirm Deletion Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. We will send a verification code to your email
                    <span className="font-medium text-foreground"> {user?.email}</span> to confirm
                    deletion. All your data including listings, bookings, and messages will be permanently removed.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={sendingOtp}
                    onClick={handleSendOtp}
                  >
                    {sendingOtp ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</>
                    ) : (
                      <><Mail className="mr-2 h-4 w-4" /> Send Verification Code</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* OTP Verification Dialog */}
            <Dialog open={otpDialogOpen} onOpenChange={(open) => { if (!deleting) setOtpDialogOpen(open); setOtpValue(""); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Enter Verification Code</DialogTitle>
                  <DialogDescription>
                    We sent an 8-digit code to <span className="font-medium text-foreground">{user?.email}</span>.
                    Enter it below to permanently delete your account.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
                  <InputOTP maxLength={8} value={otpValue} onChange={setOtpValue}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => { setOtpDialogOpen(false); setOtpValue(""); }} disabled={deleting}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={otpValue.length < 8 || deleting}
                    onClick={handleConfirmDelete}
                  >
                    {deleting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                    ) : (
                      "Confirm & Delete"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;
