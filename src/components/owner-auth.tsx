import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const OwnerAuthContext = createContext<{ user: User | null; checking: boolean }>({ user: null, checking: true });

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function verify() {
      const current = ++revision;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (active && current === revision) setUser(error ? null : data.user);
      } finally {
        if (active && current === revision) setChecking(false);
      }
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        revision++;
        setUser(null);
        setChecking(false);
        void queryClient.cancelQueries({ queryKey: ["live-orders"] }).then(() => {
          queryClient.removeQueries({ queryKey: ["live-orders"] });
        });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Auth callbacks must finish before calling back into the Auth client.
        window.setTimeout(() => { if (active) void verify(); }, 0);
      }
    });
    void verify();
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [queryClient]);
  return <OwnerAuthContext.Provider value={{ user, checking }}>{children}</OwnerAuthContext.Provider>;
}

export function useOwnerAuth() { return useContext(OwnerAuthContext); }