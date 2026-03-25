"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";

export const AuthGuard = ({ children }: PropsWithChildren) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const query = typeof window !== "undefined" ? window.location.search : "";
      const nextPath = pathname + query;
      router.replace("/auth/login?next=" + encodeURIComponent(nextPath));
    }
  }, [isLoading, pathname, router, user]);

  if (isLoading) {
    return <div className="center-shell">Ish maydoni yuklanmoqda...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
