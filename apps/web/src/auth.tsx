import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken, TOKEN_KEY, User } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Synchronisation entre onglets : si le token change/disparaît depuis un AUTRE
  // onglet (connexion à un autre compte, déconnexion), on réaligne l'utilisateur.
  // Sans cela, un onglet transporteur peut garder l'affichage transporteur alors
  // que le token est devenu celui d'un admin → « Accès refusé pour ce rôle » à la soumission.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key && e.key !== TOKEN_KEY) return; // e.key === null lors d'un localStorage.clear()
      const t = getToken();
      if (!t) {
        setUser(null);
        return;
      }
      api<User>('/auth/me').then(setUser).catch(() => {
        setToken(null);
        setUser(null);
      });
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
