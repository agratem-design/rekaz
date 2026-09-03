import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'engineer' | 'accountant' | 'supervisor';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  engineerId: string | null;
  isAdmin: boolean;
  isEngineer: boolean;
  isAccountant: boolean;
  isSupervisor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const sessionVersion = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [engineerId, setEngineerId] = useState<string | null>(null);

  const fetchUserRole = async (userId: string, version: number) => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (sessionVersion.current === version) {
        const priority: AppRole[] = ['admin', 'accountant', 'engineer', 'supervisor'];
        setRole(roleError ? null : priority.find(candidate => roleData?.some(row => row.role === candidate)) || null);
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('engineer_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (sessionVersion.current === version) {
        setEngineerId(profileData?.engineer_id || null);
      }
    } catch (error) {
      if (sessionVersion.current === version) { setRole(null); setEngineerId(null); }
      console.error('Error fetching user role:', error);
    }
  };

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      const version = ++sessionVersion.current;
      const nextUserId = nextSession?.user?.id || null;
      const userChanged = currentUserId.current !== nextUserId;
      if (userChanged) {
        queryClient.clear();
        setRole(null);
        setEngineerId(null);
      }
      currentUserId.current = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user || null);
      // Background token refresh must not unmount a form and discard its draft.
      if (!nextUserId) setLoading(false);
      else if (userChanged) setLoading(true);
      if (nextUserId) setTimeout(() => {
        fetchUserRole(nextUserId, version).finally(() => {
          if (sessionVersion.current === version) setLoading(false);
        });
      }, 0);
    };
    const initialVersion = sessionVersion.current;
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applySession(session);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (sessionVersion.current !== initialVersion) return;
      if (error) {
        supabase.auth.signOut().catch(() => {});
        applySession(null);
      } else {
        applySession(session);
      }
    }).catch(() => {
      if (sessionVersion.current === initialVersion) setLoading(false);
    });

    return () => { sessionVersion.current++; subscription.unsubscribe(); };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    sessionVersion.current++;
    currentUserId.current = null;
    queryClient.clear();
    setUser(null);
    setSession(null);
    setLoading(false);
    setRole(null);
    setEngineerId(null);
  };

  const value = {
    user,
    session,
    loading,
    role,
    engineerId,
    isAdmin: role === 'admin',
    isEngineer: role === 'engineer',
    isAccountant: role === 'accountant',
    isSupervisor: role === 'supervisor',
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
