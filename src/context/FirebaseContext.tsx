import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { DEFAULT_AUTHORIZED_ADMIN_EMAIL } from '../data/seedData';
import { SchoolDatabase } from '../types';
import {
  ensureAdminDocInFirestore,
  loadSchoolDatabaseFromFirestore,
  syncSchoolDatabaseToFirestore,
} from '../utils/firestoreSync';

interface FirebaseContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  signInAdminWithGoogle: (
    expectedEmail?: string,
  ) => Promise<{ ok: boolean; email?: string; error?: string }>;
  signOutFirebase: () => Promise<void>;
  loadFromFirestore: () => Promise<Partial<SchoolDatabase> | null>;
  syncToFirestore: (db: SchoolDatabase) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInAdminWithGoogle = async (
    expectedEmail = DEFAULT_AUTHORIZED_ADMIN_EMAIL,
  ): Promise<{ ok: boolean; email?: string; error?: string }> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      const email = (user.email || '').trim().toLowerCase();
      const targetEmail = expectedEmail.trim().toLowerCase();
      if (!email || !user.emailVerified || email !== targetEmail) {
        await signOut(auth);
        return {
          ok: false,
          error:
            'Access Denied: Admin Panel is restricted to one authorized user only. Other users or email addresses are not permitted.',
        };
      }
      await ensureAdminDocInFirestore(user);
      return { ok: true, email };
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In failed.';
      if (msg.includes('popup-closed-by-user')) {
        return { ok: false, error: 'Google sign-in popup was closed.' };
      }
      return { ok: false, error: msg };
    }
  };

  const signOutFirebase = async () => {
    await signOut(auth);
  };

  const loadFromFirestore = async () => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return null;
    return loadSchoolDatabaseFromFirestore(user);
  };

  const syncToFirestore = async (db: SchoolDatabase) => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return;
    await syncSchoolDatabaseToFirestore(user, db);
  };

  return (
    <FirebaseContext.Provider
      value={{
        authReady,
        firebaseUser,
        signInAdminWithGoogle,
        signOutFirebase,
        loadFromFirestore,
        syncToFirestore,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
