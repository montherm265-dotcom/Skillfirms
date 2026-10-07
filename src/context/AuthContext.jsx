import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

// Identity is shared with Talfirms by construction: this signs up/in
// against the exact same Supabase Auth instance, so the same email +
// password works on both products, and `profile` below is the same
// public.profiles row Talfirms itself reads and writes.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      loadProfile(data.session?.user?.id).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || null } },
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      await loadProfile(data.user?.id);
    }
    return { ...data, needsEmailConfirmation: !data.session };
  }, [loadProfile]);

  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) setSession(data.session);
    await loadProfile(data.session?.user?.id);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
