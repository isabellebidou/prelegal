"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "@/lib/api";
import type { User } from "@/lib/api";

interface Auth {
  /** The signed-in user; null for a guest, undefined while still checking. */
  user: User | null | undefined;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** Holds the signed-in user for the whole app. The session itself is an HttpOnly cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api
      .getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const value: Auth = {
    user,
    signIn: async (email, password) => {
      const signedIn = await api.signIn(email, password);
      setUser(signedIn);
      return signedIn;
    },
    signUp: async (name, email, password) => {
      const created = await api.signUp(name, email, password);
      setUser(created);
      return created;
    },
    signOut: async () => {
      await api.signOut();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
