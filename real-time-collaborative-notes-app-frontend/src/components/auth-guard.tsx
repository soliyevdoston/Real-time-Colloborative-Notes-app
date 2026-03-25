"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";

export const AuthGuard = ({ children }: PropsWithChildren) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && !user) {
      const query = searchParams.toString();
      const search = query ? `?${query}` : "";
      const nextPath = pathname + search;
      router.replace("/auth/login?next=" + encodeURIComponent(nextPath));
    }
  }, [isLoading, pathname, router, searchParams, user]);

  if (isLoading) {
    return <div className="center-shell">Ish maydoni yuklanmoqda...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
