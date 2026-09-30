import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  onAuthStateChanged,
} from 'firebase/auth';

import {
  auth,
} from '../firebase/config';

import {
  getUserProfile,
} from '../services/familyService';

import {
  login,
  logout,
  register,
} from '../services/authService';

const AuthContext =
  createContext(null);

export function AuthProvider({
  children,
}) {
  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    initializing,
    setInitializing,
  ] = useState(true);

  const [
    authError,
    setAuthError,
  ] = useState('');

  const refreshProfile =
    useCallback(
      async (uid) => {
        const targetUid =
          uid ||
          auth.currentUser?.uid;

        if (!targetUid) {
          setProfile(null);
          return null;
        }

        const next =
          await getUserProfile(
            targetUid
          );

        setProfile(next);

        return next;
      },
      []
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          setFirebaseUser(
            user
          );
          setAuthError('');

          try {
            if (!user) {
              setProfile(null);
              return;
            }

            const nextProfile =
              await refreshProfile(
                user.uid
              );

            if (!nextProfile) {
              throw new Error(
                'Your Firebase login exists, but your Coop profile was not found.'
              );
            }
          } catch (error) {
            console.log(
              'AUTH RESTORE ERROR:',
              error
            );

            setProfile(null);

            setAuthError(
              error?.message ||
                'Could not load your Coop profile.'
            );
          } finally {
            setInitializing(
              false
            );
          }
        }
      );

    return unsubscribe;
  }, [refreshProfile]);

  const signIn =
    useCallback(
      async (
        email,
        password
      ) => {
        setAuthError('');

        const user =
          await login(
            email,
            password
          );

        const nextProfile = await refreshProfile(
          user.uid
        );

        return nextProfile;
      },
      [refreshProfile]
    );

  const signUp =
    useCallback(
      async (form) => {
        setAuthError('');

        const result =
          await register(form);

        // The Firebase auth listener will also
        // run, but explicitly refreshing here
        // makes the registration flow deterministic.
        const nextProfile = await refreshProfile(
          result.user.uid
        );

        return result;
      },
      [refreshProfile]
    );

  const signOutUser =
    useCallback(
      async () => {
        await logout();

        setFirebaseUser(null);
        setProfile(null);
        setAuthError('');
      },
      []
    );

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      initializing,
      authError,
      signIn,
      signUp,
      signOut:
        signOutUser,
      refreshProfile,
    }),
    [
      firebaseUser,
      profile,
      initializing,
      authError,
      signIn,
      signUp,
      signOutUser,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.'
    );
  }

  return context;
}
