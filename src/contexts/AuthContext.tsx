import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import { SessionExpiredModal } from '../components/auth/SessionExpiredModal';
import { pointsService } from '../services/pointsService';
import { panelUsersService } from '../services/panelUsersService';
import {
  clearCachedSplashUser,
  readCachedSplashUser,
  writeCachedSplashUser,
} from '../utils/userSplashCache';
import {
  ALL_ROUTE_PATHS,
  CREATOR_EMAIL,
  canProfileAccessRoute,
  getFirstAllowedRoute,
  isAdminRole,
  isCreatorEmail,
  type PanelUserProfile,
} from '../config/permissions';

interface UserDataWithPoints {
  uid: string;
  email: string | null;
  displayName: string | null;
  name?: string | null;
  points: number;
  referrals?: unknown[];
}

interface AuthContextType {
  user: User | null;
  userData: UserDataWithPoints | null;
  panelProfile: PanelUserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  pinUnlocked: boolean;
  unlockPinSession: () => void;
  lockScreen: () => void;
  canAccessRoute: (pathname: string) => boolean;
  firstAllowedRoute: string;
  refreshPanelProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

function buildCreatorFallbackProfile(user: User): PanelUserProfile {
  const cached = readCachedSplashUser();
  const isSameCached = Boolean(cached && cached.email.toLowerCase() === CREATOR_EMAIL);
  return {
    uid: user.uid,
    name: user.displayName || (isSameCached ? cached?.name : '') || 'Niall (Criador)',
    email: CREATOR_EMAIL,
    role: 'creator',
    active: true,
    allowedRoutes: ALL_ROUTE_PATHS,
    photoUrl: user.photoURL || (isSameCached ? cached?.photoUrl || '' : ''),
    jobTitle: 'Criador & Administrador Master',
    hasPin: isSameCached ? Boolean(cached?.hasPin) : false,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDataWithPoints | null>(null);
  const [panelProfile, setPanelProfile] = useState<PanelUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pinUnlockedUid, setPinUnlockedUid] = useState<string | null>(null);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  const syncCurrentUserProfile = useCallback(async (firebaseUser: User) => {
    try {
      const result = await panelUsersService.syncSelf();
      if (result?.authorized && result.profile) {
        setPanelProfile(result.profile);
      } else if (isCreatorEmail(firebaseUser.email)) {
        setPanelProfile(buildCreatorFallbackProfile(firebaseUser));
      } else {
        setPanelProfile(null);
      }
    } catch (error) {
      console.error('Erro ao sincronizar perfil de permissões:', error);
      if (isCreatorEmail(firebaseUser.email)) {
        setPanelProfile(buildCreatorFallbackProfile(firebaseUser));
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedExpiry = localStorage.getItem('firebase_user_expiry');
    if (storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      if (Number.isFinite(expiryTime) && Date.now() >= expiryTime) {
        localStorage.removeItem('firebase_user');
        localStorage.removeItem('firebase_user_expiry');
        setShowSessionExpired(true);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const expiryTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('firebase_user_expiry', expiryTime.toString());

        if (isCreatorEmail(firebaseUser.email)) {
          setPanelProfile(buildCreatorFallbackProfile(firebaseUser));
        }
        setProfileLoading(true);

        try {
          await pointsService.giveFirstLoginBonus(firebaseUser.uid);
          const points = await pointsService.getPointsBalance(firebaseUser.uid);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            name: firebaseUser.displayName,
            points,
            referrals: [],
          });
        } catch (error) {
          console.error('Erro ao processar dados do usuário:', error);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            name: firebaseUser.displayName,
            points: 0,
            referrals: [],
          });
        }
      } else {
        localStorage.removeItem('firebase_user');
        localStorage.removeItem('firebase_user_expiry');
        setUserData(null);
        setPanelProfile(null);
        setPinUnlockedUid(null);
        setProfileLoading(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Escuta em tempo real as permissões do usuário em panel_users/{uid} + sincroniza via Cloud Function
  useEffect(() => {
    if (!user) return;

    let unsubscribed = false;
    setProfileLoading(true);

    const userDocRef = doc(db, 'panel_users', user.uid);
    const unsubDoc = onSnapshot(
      userDocRef,
      (snap) => {
        if (unsubscribed) return;
        if (snap.exists()) {
          const data = snap.data() as PanelUserProfile;
          const normalized: PanelUserProfile = {
            ...data,
            uid: user.uid,
            email: data.email || user.email || '',
            allowedRoutes: Array.isArray(data.allowedRoutes) ? data.allowedRoutes : [],
          };
          if (isCreatorEmail(user.email)) {
            setPanelProfile({
              ...normalized,
              role: 'creator',
              active: true,
              allowedRoutes: ALL_ROUTE_PATHS,
            });
          } else {
            setPanelProfile(normalized);
          }
          setProfileLoading(false);
        } else {
          void syncCurrentUserProfile(user);
        }
      },
      (err) => {
        console.error('Erro ao escutar permissões do operador:', err);
        if (!unsubscribed) {
          void syncCurrentUserProfile(user);
        }
      }
    );

    // Garante registro de lastLoginAt e bootstrap de custom claims do Criador
    void panelUsersService
      .syncSelf()
      .then((res) => {
        if (unsubscribed) return;
        if (res?.authorized && res.profile) {
          setPanelProfile(res.profile);
          setProfileLoading(false);
        } else if (isCreatorEmail(user.email)) {
          setPanelProfile(buildCreatorFallbackProfile(user));
          setProfileLoading(false);
        }
      })
      .catch(() => {
        if (!unsubscribed && isCreatorEmail(user.email)) {
          setPanelProfile(buildCreatorFallbackProfile(user));
          setProfileLoading(false);
        }
      });

    return () => {
      unsubscribed = true;
      unsubDoc();
    };
  }, [user, syncCurrentUserProfile]);

  const refreshPanelProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    await syncCurrentUserProfile(user);
  }, [user, syncCurrentUserProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('firebase_user');
    localStorage.removeItem('firebase_user_expiry');
    clearCachedSplashUser();
    setUserData(null);
    setPanelProfile(null);
    setPinUnlockedUid(null);
  };

  const unlockPinSession = useCallback(() => {
    if (user?.uid) {
      setPinUnlockedUid(user.uid);
    }
  }, [user?.uid]);

  const lockScreen = useCallback(() => {
    setPinUnlockedUid(null);
  }, []);

  const handleSessionExpiredClose = () => {
    setShowSessionExpired(false);
  };

  const effectiveProfile = useMemo<PanelUserProfile | null>(() => {
    if (panelProfile) return panelProfile;
    if (user && isCreatorEmail(user.email)) {
      return buildCreatorFallbackProfile(user);
    }
    return null;
  }, [panelProfile, user]);

  // Se o perfil terminou de carregar sem PIN configurado, libera a sessão atual
  // (evita travar o admin imediatamente no instante em que ele cadastra o próprio PIN)
  useEffect(() => {
    if (user && !profileLoading && effectiveProfile?.active && !effectiveProfile.hasPin) {
      setPinUnlockedUid((prev) => (prev === user.uid ? prev : user.uid));
    }
  }, [user, profileLoading, effectiveProfile]);

  // Mantém o cache da foto, nome e status do PIN para a tela de entrada 0ms
  useEffect(() => {
    if (user && effectiveProfile && effectiveProfile.active) {
      writeCachedSplashUser({
        uid: user.uid,
        name: effectiveProfile.name || user.displayName || user.email || 'Operador',
        email: effectiveProfile.email || user.email || '',
        role: effectiveProfile.role,
        photoUrl: effectiveProfile.photoUrl || user.photoURL || '',
        jobTitle: effectiveProfile.jobTitle || '',
        hasPin: Boolean(effectiveProfile.hasPin),
      });
    }
  }, [user, effectiveProfile]);

  const isCreator = Boolean(
    effectiveProfile?.role === 'creator' || (user && isCreatorEmail(user.email))
  );
  const isAdmin = Boolean(effectiveProfile?.active && isAdminRole(effectiveProfile.role));
  const pinUnlocked = Boolean(user && pinUnlockedUid === user.uid);

  const canAccessRoute = useCallback(
    (pathname: string) => canProfileAccessRoute(effectiveProfile, pathname),
    [effectiveProfile]
  );

  const firstAllowedRoute = useMemo(
    () => getFirstAllowedRoute(effectiveProfile),
    [effectiveProfile]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userData,
      panelProfile: effectiveProfile,
      loading,
      profileLoading,
      isCreator,
      isAdmin,
      pinUnlocked,
      unlockPinSession,
      lockScreen,
      canAccessRoute,
      firstAllowedRoute,
      refreshPanelProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logout,
    }),
    [
      user,
      userData,
      effectiveProfile,
      loading,
      profileLoading,
      isCreator,
      isAdmin,
      pinUnlocked,
      unlockPinSession,
      lockScreen,
      canAccessRoute,
      firstAllowedRoute,
      refreshPanelProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal isOpen={showSessionExpired} onClose={handleSessionExpiredClose} />
    </AuthContext.Provider>
  );
};
