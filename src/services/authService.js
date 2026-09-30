import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import * as SecureStore from 'expo-secure-store';

import {
  auth,
  db,
} from '../firebase/config';

import { isStrongPassword } from '../utils/passwordRules';

const TOKEN_KEY = 'coop_firebase_id_token';

function generateInviteCode() {
  const characters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for (let i = 0; i < 6; i += 1) {
    code +=
      characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];
  }

  return code;
}

export async function storeCurrentIdToken(user) {
  if (!user) {
    await SecureStore.deleteItemAsync(
      TOKEN_KEY
    );

    return;
  }

  const token =
    await user.getIdToken();

  await SecureStore.setItemAsync(
    TOKEN_KEY,
    token
  );
}

export async function login(email, password) {
  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

    await storeCurrentIdToken(
      credential.user
    );

    return credential.user;
  } catch (error) {
    console.log(
      'LOGIN ERROR:',
      error
    );

    throw error;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(
    TOKEN_KEY
  );

  await signOut(auth);
}

export async function register({
  name,
  email,
  password,
  role,
  mode = 'create',
  familyName,
  inviteCode,
}) {
  const cleanName =
    name?.trim();

  const cleanEmail =
    email?.trim().toLowerCase();

  const cleanCode =
    inviteCode
      ?.trim()
      .toUpperCase();

  // ---------------------------------------------------------
  // Basic validation
  // ---------------------------------------------------------

  if (!cleanName) {
    throw new Error(
      'Enter your name.'
    );
  }

  if (!cleanEmail) {
    throw new Error(
      'Enter your email address.'
    );
  }

  if (!isStrongPassword(password)) {
    throw new Error(
      'Password must be at least 8 characters and include a capital letter, number, and special character.'
    );
  }

  if (
    !['parent', 'child'].includes(
      role
    )
  ) {
    throw new Error(
      'Choose a valid account type.'
    );
  }

  if (
    role === 'parent' &&
    mode === 'create' &&
    !familyName?.trim()
  ) {
    throw new Error(
      'Enter a household name.'
    );
  }

  if (
    mode === 'join' &&
    (!cleanCode ||
      cleanCode.length !== 6)
  ) {
    throw new Error(
      'Enter the 6-character household code.'
    );
  }

  console.log(
    'Starting Coop registration...'
  );

  console.log(
    'Role:',
    role
  );

  console.log(
    'Mode:',
    mode
  );

  try {
    // ========================================================
    // STEP 1
    // Create Firebase Authentication account
    // ========================================================

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user =
      credential.user;

    console.log(
      'Firebase Auth account created:',
      user.uid
    );

    await updateProfile(
      user,
      {
        displayName:
          cleanName,
      }
    );

    // ========================================================
    // STEP 2
    // Parent creates NEW household
    // ========================================================

    if (
      role === 'parent' &&
      mode === 'create'
    ) {
      console.log(
        'Creating parent household...'
      );

      // Create an ID for the household.
      const householdRef =
        doc(
          collection(
            db,
            'households'
          )
        );

      const householdId =
        householdRef.id;

      // Generate the family invitation code.
      const generatedCode =
        generateInviteCode();

      console.log(
        'Household ID:',
        householdId
      );

      console.log(
        'Household code:',
        generatedCode
      );

      // ------------------------------------------------------
      // Create parent profile
      // ------------------------------------------------------

      await setDoc(
        doc(
          db,
          'users',
          user.uid
        ),
        {
          name: cleanName,
          email: cleanEmail,
          role: 'parent',
          householdId,
          points: 0,
          isAvailable: true,
          profilePhotoUrl: null,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        'Parent profile created.'
      );

      // ------------------------------------------------------
      // Create household
      // ------------------------------------------------------

      await setDoc(
        householdRef,
        {
          name:
            familyName.trim(),
          inviteCode:
            generatedCode,
          createdBy:
            user.uid,
          streak: 0,
          lastStreakDate: null,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        'Household created.'
      );

      // ------------------------------------------------------
      // Create family-code lookup
      // ------------------------------------------------------

      await setDoc(
        doc(
          db,
          'householdCodes',
          generatedCode
        ),
        {
          householdId,
          createdBy:
            user.uid,
          createdAt:
            serverTimestamp(),
        }
      );

      console.log(
        'Household code created.'
      );

      await storeCurrentIdToken(
        user
      );

      console.log(
        'Parent registration completed.'
      );

      return {
        user,
        householdId,
        householdCode:
          generatedCode,
      };
    }

    // ========================================================
    // STEP 3
    // Parent joins EXISTING household
    // ========================================================

    if (
      role === 'parent' &&
      mode === 'join'
    ) {
      console.log(
        'Parent joining existing household...'
      );

      console.log(
        'Looking up household code:',
        cleanCode
      );

      const codeSnap =
        await getDoc(
          doc(
            db,
            'householdCodes',
            cleanCode
          )
        );

      if (!codeSnap.exists()) {
        throw new Error(
          'That household code does not exist.'
        );
      }

      const householdId =
        codeSnap.data()
          .householdId;

      console.log(
        'Found household:',
        householdId
      );

      // We know the household ID from the
      // invitation-code document, so create
      // the parent's profile directly.
      await setDoc(
        doc(
          db,
          'users',
          user.uid
        ),
        {
          name: cleanName,
          email: cleanEmail,
          role: 'parent',
          householdId,
          points: 0,
          isAvailable: true,
          profilePhotoUrl: null,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        'Parent profile created.'
      );

      await storeCurrentIdToken(
        user
      );

      console.log(
        'Parent successfully joined household.'
      );

      return {
        user,
        householdId,
        householdCode:
          cleanCode,
      };
    }

    // ========================================================
    // STEP 4
    // Child joins EXISTING household
    // ========================================================

    if (
      role === 'child' &&
      mode === 'join'
    ) {
      console.log(
        'Child joining household...'
      );

      console.log(
        'Looking up household code:',
        cleanCode
      );

      const codeSnap =
        await getDoc(
          doc(
            db,
            'householdCodes',
            cleanCode
          )
        );

      if (!codeSnap.exists()) {
        throw new Error(
          'That household code does not exist.'
        );
      }

      const householdId =
        codeSnap.data()
          .householdId;

      console.log(
        'Found household:',
        householdId
      );

      // Create child profile.
      await setDoc(
        doc(
          db,
          'users',
          user.uid
        ),
        {
          name: cleanName,
          email: cleanEmail,
          role: 'child',
          householdId,
          points: 0,
          isAvailable: true,
          profilePhotoUrl: null,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        'Child profile created.'
      );

      await storeCurrentIdToken(
        user
      );

      console.log(
        'Child successfully joined household.'
      );

      return {
        user,
        householdId,
        householdCode:
          cleanCode,
      };
    }

    // ========================================================
    // Invalid combination
    // ========================================================

    throw new Error(
      'Invalid account registration options.'
    );
  } catch (error) {
    console.log(
      '============================'
    );

    console.log(
      'COOP REGISTRATION ERROR'
    );

    console.log(
      'code:',
      error?.code
    );

    console.log(
      'message:',
      error?.message
    );

    console.log(
      '============================'
    );

    // Do NOT automatically delete the
    // Firebase Auth account.
    //
    // That lets us inspect what actually
    // happened in Firebase.

    throw error;
  }
}
