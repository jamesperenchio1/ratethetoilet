import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/useAuth";
import type { Profile } from "../lib/types";
import { HandleSheet } from "./HandleSheet";

interface IdentityGateValue extends ReturnType<typeof useAuth> {
  /** Runs `action` once a confirmed identity exists. If this is the user's
   * first-ever write, shows the handle picker sheet first (S11) — exactly
   * once, ever, per the flow map. */
  withIdentity: <T>(action: (profile: Profile) => Promise<T>) => Promise<T>;
}

const Ctx = createContext<IdentityGateValue | null>(null);

export function IdentityGateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [pendingHandle, setPendingHandle] = useState<string | null>(null);
  const resolverRef = useRef<{
    resolve: (p: Profile) => void;
    reject: (e: unknown) => void;
  } | null>(null);

  const withIdentity = useCallback(
    async <T,>(action: (profile: Profile) => Promise<T>): Promise<T> => {
      let profile = auth.profile;
      if (!profile) {
        profile = await auth.ensureIdentity();
        const confirmed = await new Promise<Profile>((resolve, reject) => {
          resolverRef.current = { resolve, reject };
          setPendingHandle(profile!.handle);
        });
        profile = confirmed;
      }
      return action(profile);
    },
    [auth]
  );

  async function handleConfirm(handle: string) {
    const updated = await auth.setHandle(handle);
    setPendingHandle(null);
    resolverRef.current?.resolve(updated);
    resolverRef.current = null;
  }

  return (
    <Ctx.Provider value={{ ...auth, withIdentity }}>
      {children}
      {pendingHandle && (
        <HandleSheet
          initialHandle={pendingHandle}
          onShuffle={auth.shuffleHandle}
          onConfirm={handleConfirm}
        />
      )}
    </Ctx.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIdentity must be used within IdentityGateProvider");
  return ctx;
}
