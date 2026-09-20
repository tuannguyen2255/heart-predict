"use client";

import { getAccessToken } from "@/lib/client-session";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (!storedUsername || !getAccessToken()) {
      router.push("/login");
    } else {
      setUsername(storedUsername);
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header user={username ? { id: 0, email: "", full_name: username } : null} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <ProfileForm />
      </main>
    </div>
  );
}
