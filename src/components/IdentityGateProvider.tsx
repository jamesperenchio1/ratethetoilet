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
  const [showHandleSheet, setShowHandleSheet] = useState(false);
  const resolversRef = useRef<Array<{
    resolve: (p: Profile) => void;
    reject: (e: unknown) => void;
  }>>([]);

  const withIdentity = useCallback(
    async <T,>(action: (profile: Profile) => Promise<T>): Promise<T> => {
      let profile = auth.profile;
      if (!profile) {
        await auth.ensureIdentity();
        const confirmed = await new Promise<Profile>((resolve, reject) => {
          resolversRef.current.push({ resolve, reject });
          setShowHandleSheet(true);
        });
        profile = confirmed;
      }
      return action(profile);
    },
    [auth]
  );

  async function handleConfirm(handle: string) {
    try {
      const updated = await auth.setHandle(handle);
      setShowHandleSheet(false);
      const pending = resolversRef.current.splice(0);
      pending.forEach((r) => r.resolve(updated));
    } catch (e) {
      // If setHandle fails (e.g. network error or the handle was taken), reject
      // any pending withIdentity resolvers so the first-write action settles
      // instead of hanging forever. The sheet stays open so the user can retry.
      const pending = resolversRef.current.splice(0);
      pending.forEach((r) => r.reject(e));
      throw e;
    }
  }

  return (
    <Ctx.Provider value={{ ...auth, withIdentity }}>
      {children}
      {showHandleSheet && (
        <HandleSheet onConfirm={handleConfirm} onSaveNameRequested={auth.sendKeepNameLink} />
      )}
    </Ctx.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIdentity must be used within IdentityGateProvider");
  return ctx;
}
