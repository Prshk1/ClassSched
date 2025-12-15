import React, { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Profile page used for admin / teacher / student profiles.
 *
 * Usage:
 *  - Route can render this component directly (it will read role from localStorage)
 *  - Or pass a `role` prop to force a specific role for the DashboardLayout:
 *      <Profile role="teacher" />
 */
type Role = "admin" | "teacher" | "student";

type Props = {
  role?: Role;
};

const LOCAL_KEYS = {
  ROLE: "userRole",
  USERNAME: "username",
  FULLNAME: "fullName",
  EMAIL: "email",
  CONTACT: "contact",
  PHOTO: "profilePhoto", // stores data URL (optional)
};

const safeInitial = (s?: string) => (s && s.length ? s : "");

export default function Profile({ role: roleProp }: Props) {
  const { toast } = useToast();

  // determine role: prop takes precedence, otherwise read from localStorage, default to "teacher"
  const [userRole, setUserRole] = useState<Role>(() => {
    if (roleProp) return roleProp;
    const stored = (localStorage.getItem(LOCAL_KEYS.ROLE) as Role) || null;
    return stored ?? "teacher";
  });

  // form state
  const [username, setUsername] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  // keep an initial snapshot so Cancel can revert
  const snapshotRef = useRef<{ username: string; fullName: string; email: string; contact: string; photo?: string | null } | null>(null);

  // file input ref for changing photo
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // load persisted values
    const storedRole = (localStorage.getItem(LOCAL_KEYS.ROLE) as Role) || null;
    if (!roleProp && storedRole) setUserRole(storedRole);

    const storedUsername = localStorage.getItem(LOCAL_KEYS.USERNAME) ?? "";
    const storedFullName = localStorage.getItem(LOCAL_KEYS.FULLNAME) ?? storedUsername ?? "";
    const storedEmail = localStorage.getItem(LOCAL_KEYS.EMAIL) ?? (storedUsername ? `${storedUsername.toLowerCase().replace(/\s+/g, ".")}@school.edu` : "");
    const storedContact = localStorage.getItem(LOCAL_KEYS.CONTACT) ?? "";
    const storedPhoto = localStorage.getItem(LOCAL_KEYS.PHOTO);

    setUsername(storedUsername);
    setFullName(storedFullName);
    setEmail(storedEmail);
    setContact(storedContact);
    setPhotoDataUrl(storedPhoto ?? null);

    snapshotRef.current = {
      username: storedUsername,
      fullName: storedFullName,
      email: storedEmail,
      contact: storedContact,
      photo: storedPhoto ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleProp]);

  const initials = (() => {
    const source = fullName || username || "";
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  })();

  const validateEmail = (v: string) => {
    if (!v) return false;
    // simple RFC-lite check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

  const handleSaveChanges = () => {
    // basic validation
    if (!fullName.trim()) {
      toast({ title: "Validation error", description: "Full name cannot be empty." });
      return;
    }
    if (email && !validateEmail(email)) {
      toast({ title: "Validation error", description: "Please enter a valid email address." });
      return;
    }

    try {
      localStorage.setItem(LOCAL_KEYS.ROLE, userRole);
      localStorage.setItem(LOCAL_KEYS.USERNAME, fullName);
      localStorage.setItem(LOCAL_KEYS.FULLNAME, fullName);
      if (email) localStorage.setItem(LOCAL_KEYS.EMAIL, email);
      else localStorage.removeItem(LOCAL_KEYS.EMAIL);
      if (contact) localStorage.setItem(LOCAL_KEYS.CONTACT, contact);
      else localStorage.removeItem(LOCAL_KEYS.CONTACT);
      if (photoDataUrl) localStorage.setItem(LOCAL_KEYS.PHOTO, photoDataUrl);
      toast({ title: "Profile Updated", description: "Your profile information has been saved successfully." });

      // update snapshot
      snapshotRef.current = { username: fullName, fullName, email, contact, photo: photoDataUrl ?? null };
      setUsername(fullName);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to save profile:", err);
      toast({ title: "Save failed", description: "Unable to save your profile. Try again." });
    }
  };

  const handleCancel = () => {
    const s = snapshotRef.current;
    if (!s) return;
    setUsername(s.username);
    setFullName(s.fullName);
    setEmail(s.email);
    setContact(s.contact);
    setPhotoDataUrl(s.photo ?? null);
    toast({ title: "Reverted", description: "Changes were reverted." });
  };

  const handleChangePhotoClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // only accept images
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file." });
      return;
    }
    // convert to data URL for preview + localStorage (small images only)
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPhotoDataUrl(result);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to read file", err);
      toast({ title: "Failed", description: "Unable to read the selected file." });
    } finally {
      // clear input so same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <DashboardLayout userRole={userRole}>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                {photoDataUrl ? (
                  <AvatarImage src={photoDataUrl} alt={fullName || username} />
                ) : (
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
                )}
              </Avatar>

              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                <Button variant="outline" onClick={handleChangePhotoClick}>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </Button>
                <div className="text-sm text-muted-foreground">Recommended: 200x200px, JPG/PNG</div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input id="contact" type="tel" placeholder="+63 XXX XXX XXXX" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <Input value={userRole.charAt(0).toUpperCase() + userRole.slice(1)} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSaveChanges}>Save Changes</Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}