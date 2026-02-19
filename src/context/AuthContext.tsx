import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function displayNameFromUser(user: User): string {
  const fromMeta = user.user_metadata?.display_name;
  if (typeof fromMeta === 'string' && fromMeta.trim().length > 0) {
    return fromMeta.trim();
  }

  if (user.email) {
    return user.email.split('@')[0] || 'Reader';
  }

  return 'Reader';
}

async function ensureProfile(user: User): Promise<void> {
  const displayName = displayNameFromUser(user);

  const { error } = await supabase.from('users').upsert(
    { auth_user_id: user.id, display_name: displayName },
    { onConflict: 'auth_user_id' },
  );

  if (error) {
    // Profile table or policies might not be applied yet in early setup.
    console.warn('ensureProfile failed:', error.message);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setErrorMessage('Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setSession(null);
        } else {
          setSession(data.session);
        }

        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load session');
        setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
      errorMessage,
      signIn: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }

        if (data.user) {
          await ensureProfile(data.user);
        }
      },
      signUp: async (email: string, password: string, displayName: string) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          await ensureProfile(data.user);
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [errorMessage, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
