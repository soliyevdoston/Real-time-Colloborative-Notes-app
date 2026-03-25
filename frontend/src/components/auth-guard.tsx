"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";

export const AuthGuard = ({ children }: PropsWithChildren) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/login");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return <div className="center-shell">Loading workspace...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
