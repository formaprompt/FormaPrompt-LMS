import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let isActive = true;
    const deferredTasks = new Set();

    const fetchProfile = async (currentUser) => {
      if (!isActive) return;
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
        
      if (error) {
        console.error("Erreur lors de la récupération du profil :", error);
      }

      if (!isActive) return;
      setUser(currentUser);
      setRole(data?.role || 'user');
      setLoading(false);
    };

    // Vérifie la session auprès du serveur : getSession() seul peut retourner
    // un ancien jeton encore présent dans le navigateur après une déconnexion.
    const validateInitialSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setSessionExpired(false);
        await fetchProfile(null);
        return;
      }

      const { data, error } = await supabase.auth.getUser(sessionData.session.access_token);
      if (error) {
        setSessionExpired(true);
        await supabase.auth.signOut({ scope: 'local' });
        await fetchProfile(null);
        return;
      }
      setSessionExpired(false);
      await fetchProfile(data.user);
    };
    validateInitialSession();

    // Écouter les changements d'état (connexion, déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setSessionExpired(false);
      const task = window.setTimeout(() => {
        deferredTasks.delete(task);
        fetchProfile(session?.user);
      }, 0);
      deferredTasks.add(task);
    });

    return () => {
      isActive = false;
      deferredTasks.forEach((task) => window.clearTimeout(task));
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    role,
    loading,
    sessionExpired,
    signOut: () => {
      setSessionExpired(false);
      return supabase.auth.signOut();
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
