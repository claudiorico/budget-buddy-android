import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  // Web Client ID (type "Web application") do Google Cloud Console
  // OAuth 2.0 > Credenciais > Criar ID do cliente OAuth > Aplicativo da Web
  webClientId: '849799119137-3susk1bcec9d5iukk8h2fpd5due5i8ne.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/drive.appdata',
  ],
});

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  /** True while restoring a previous session on app start */
  restoring: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // ── Restore previous session on app start ───────────────────────────────

  useEffect(() => {
    if (Platform.OS === 'web') {
      setRestoring(false);
      return;
    }
    (async () => {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
        const response = await GoogleSignin.signInSilently();
        if (response.type === 'success') {
          const u = response.data.user;
          setUser({ id: u.id, name: u.name, email: u.email, photo: u.photo });
        }
      } catch (e: any) {
        // No previous session or play services unavailable — stay logged out
        if (e.code !== statusCodes.SIGN_IN_REQUIRED) {
          console.warn('Silent sign-in error:', e.message);
        }
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  // ── Interactive sign-in ─────────────────────────────────────────────────

  const signIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        const u = response.data.user;
        setUser({ id: u.id, name: u.name, email: u.email, photo: u.photo });
      }
    } catch (e: any) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        console.error('Google Sign-In error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch { /* ignore */ }
    setUser(null);
  };

  // ── Access token for Drive API ──────────────────────────────────────────

  const getAccessToken = async (): Promise<string> => {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  };

  return (
    <AuthContext.Provider value={{ user, loading, restoring, signIn, signOut, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
