"use client";

import { useEffect, useState } from "react";
import { getUserFromToken, hasSupabaseEnv } from "./supabase";

type SessionUser = {
  id: string;
  email?: string;
};

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("access_token");
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!token) {
    localStorage.removeItem("access_token");
    return;
  }
  localStorage.setItem("access_token", token);
}

export function useSessionUser() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!hasSupabaseEnv()) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const token = getAccessToken();
      if (!token) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const currentUser = await getUserFromToken(token);
      if (!mounted) {
        return;
      }
      setUser(currentUser);
      setLoading(false);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}
