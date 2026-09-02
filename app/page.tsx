"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firstAccessiblePath } from "@/lib/permission-codes";

export default function Home() {
  const { isAuthenticated, authReady, can, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) {
      router.replace(firstAccessiblePath(can, user?.roles));
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, authReady, router, can, user?.roles]);

  return null;
}
