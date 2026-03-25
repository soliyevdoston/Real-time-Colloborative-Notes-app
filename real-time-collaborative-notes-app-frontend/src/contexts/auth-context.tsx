"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiUrl, parseApiError } from "@/lib/api";
import { AuthUser } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_TOKEN_KEY = "collab_notes_access_token";

const parseAuthResponse = async (response: Response): Promise<{ user: AuthUser; accessToken: string }> => {
  const data = (await response.json()) as {
    user: AuthUser;
    accessToken: string;
  };

  return data;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSession = useCallback((nextUser: AuthUser, nextAccessToken: string) => {
    setUser(nextUser);
    setAccessToken(nextAccessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }, []);

  const refreshSession = useCallback(async () => {
    const response = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      clearSession();
      throw new Error(await parseApiError(response));
    }

    const data = await parseAuthResponse(response);
    setSession(data.user, data.accessToken);
  }, [clearSession, setSession]);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setAccessToken(token);
        await refreshSession();
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [clearSession, refreshSession]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = await parseAuthResponse(response);
      setSession(data.user, data.accessToken);
    },
    [setSession],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const response = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = await parseAuthResponse(response);
      setSession(data.user, data.accessToken);
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });

    clearSession();
  }, [clearSession]);

  const authenticatedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const hasFormDataBody = init?.body instanceof FormData;

      const execute = async (token: string | null) => {
        const headers = new Headers(init?.headers);
        if (!hasFormDataBody && !headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }

        return fetch(apiUrl(path), {
          ...init,
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...Object.fromEntries(headers.entries()),
          },
        });
      };

      let response = await execute(accessToken);

      if (response.status === 401) {
        try {
          await refreshSession();
          response = await execute(localStorage.getItem(ACCESS_TOKEN_KEY));
        } catch {
          clearSession();
        }
      }

      return response;
    },
    [accessToken, clearSession, refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      register,
      logout,
      authenticatedFetch,
      refreshSession,
    }),
    [user, accessToken, isLoading, login, register, logout, authenticatedFetch, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth faqat AuthProvider ichida ishlatilishi kerak");
  }

  return context;
};
