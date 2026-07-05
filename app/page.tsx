"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { isAuthenticated, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) {
      router.replace("/executive-dashboard");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, authReady, router]);

  return null;
}
