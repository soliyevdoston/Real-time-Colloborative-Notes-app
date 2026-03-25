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

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_TOKEN_KEY = "collab_notes_access_token";

const parseAuthResponse = async (response: Response): Promise<AuthResponse> =>
  (await response.json()) as AuthResponse;

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

  const authenticate = useCallback(
    async (path: "/auth/login" | "/auth/register", body: LoginInput | RegisterInput) => {
      const response = await fetch(apiUrl(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = await parseAuthResponse(response);
      setSession(data.user, data.accessToken);
    },
    [setSession],
  );

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

  const login = useCallback(async (input: LoginInput) => authenticate("/auth/login", input), [authenticate]);

  const register = useCallback(
    async (input: RegisterInput) => authenticate("/auth/register", input),
    [authenticate],
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

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return fetch(apiUrl(path), {
          ...init,
          credentials: "include",
          headers,
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
