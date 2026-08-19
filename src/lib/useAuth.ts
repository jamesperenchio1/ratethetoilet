import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

/**
 * Identity model (see wireframe thread 2a): browsing is fully anonymous and
 * creates nothing. A profile (and its handle) is only minted the moment the
 * user takes a write action for the first time — ensureIdentity() is that
 * moment. The handle is a display label on a stable id; renaming never
 * changes the id, and old content is never moved or re-attributed.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const s = data.session;
      if (s) {
        const p = await loadProfile(s.user.id);
        if (!mounted) return;
        // Keep the session even if there's no profile row yet — an anonymous
        // profile is only minted on the first write (ensure_profile), so a
        // missing profile here is normal, not a sign of a stale session.
        setSession(s);
        setProfile(p);
      } else {
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          const p = await loadProfile(newSession.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Guards against concurrent callers (e.g. a mount effect priming a session
  // for photo uploads racing the submit-time withIdentity() call) each
  // seeing "no session yet" and independently minting their own anonymous
  // user. All concurrent calls await the same in-flight sign-in instead.
  const signInInFlight = useRef<Promise<Session> | null>(null);

  /** Ensures an (anonymous, if needed) session exists. Does not mint a handle. */
  const ensureSession = useCallback(async (): Promise<Session> => {
    const { data: existing } = await supabase.auth.getSession();
    // Keep any existing session — an anonymous session without a profile row is
    // normal (the profile is minted on first write), so don't drop it here.
    if (existing.session) return existing.session;

    if (!signInInFlight.current) {
      signInInFlight.current = (async () => {
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error || !data.session) throw error ?? new Error("Sign-in failed");
          setSession(data.session);
          return data.session;
        } finally {
          signInInFlight.current = null;
        }
      })();
    }
    return signInInFlight.current;
  }, []);

  /**
   * Ensures a profile row (and therefore a minted handle) exists for the
   * current session, creating one via the ensure_profile() RPC the first
   * time this is called. Call this right before the first write action —
   * this is exactly "first post triggers ... once, ever" from the flow map.
   */
  const ensureIdentity = useCallback(async (): Promise<Profile> => {
    const s = await ensureSession();
    const existing = await loadProfile(s.user.id);
    if (existing) return existing;
    const { data, error } = await supabase.rpc("ensure_profile");
    if (error) throw error;
    const row = data as Profile;
    setProfile(row);
    return row;
  }, [ensureSession, loadProfile]);

  const setHandle = useCallback(
    async (newHandle: string) => {
      if (!session) throw new Error("No session");
      const { data, error } = await supabase
        .from("profiles")
        .update({ handle: newHandle })
        .eq("id", session.user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      return data as Profile;
    },
    [session]
  );

  /** S15 — "Keep this name": link an email to the current (anonymous) user. */
  const sendKeepNameLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    );
    if (error) throw error;
  }, []);

  const isGuest = !!session?.user?.is_anonymous;

  return {
    session,
    profile,
    loading,
    isGuest,
    ensureSession,
    ensureIdentity,
    setHandle,
    sendKeepNameLink,
    refreshProfile: () => (session ? loadProfile(session.user.id) : null),
  };
}
