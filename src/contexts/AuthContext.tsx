
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { SessionExpiredModal } from '../components/auth/SessionExpiredModal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  useEffect(() => {
    // Verificar se há usuário armazenado no localStorage
    const storedUser = localStorage.getItem('firebase_user');
    const storedExpiry = localStorage.getItem('firebase_user_expiry');
    
    if (storedUser && storedExpiry) {
      const now = new Date().getTime();
      const expiryTime = parseInt(storedExpiry);
      
      if (now < expiryTime) {
        // Token ainda válido
        setUser(JSON.parse(storedUser));
      } else {
        // Token expirado, remover do localStorage e mostrar popup
        localStorage.removeItem('firebase_user');
        localStorage.removeItem('firebase_user_expiry');
        setShowSessionExpired(true);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (user) {
        // Armazenar usuário no localStorage com expiração de 7 dias
        const expiryTime = new Date().getTime() + (7 * 24 * 60 * 60 * 1000); // 7 dias
        localStorage.setItem('firebase_user', JSON.stringify(user));
        localStorage.setItem('firebase_user_expiry', expiryTime.toString());
      } else {
        localStorage.removeItem('firebase_user');
        localStorage.removeItem('firebase_user_expiry');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('firebase_user');
    localStorage.removeItem('firebase_user_expiry');
  };

  const handleSessionExpiredClose = () => {
    setShowSessionExpired(false);
  };

  const value = {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredModal 
        isOpen={showSessionExpired}
        onClose={handleSessionExpiredClose}
      />
    </AuthContext.Provider>
  );
};
