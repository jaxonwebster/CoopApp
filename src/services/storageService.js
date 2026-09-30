import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';

import {
  storage,
} from '../firebase/config';

async function uploadImage(
  uri,
  path
) {
  try {
    if (
      !storage?.app?.options
        ?.storageBucket
    ) {
      throw new Error(
        'Firebase Storage is not configured. Check your Firebase storage bucket in .env.'
      );
    }

    const response =
      await fetch(uri);

    const blob =
      await response.blob();

    const storageRef =
      ref(
        storage,
        path
      );

    await uploadBytes(
      storageRef,
      blob,
      {
        contentType:
          blob.type ||
          'image/jpeg',
      }
    );

    return getDownloadURL(
      storageRef
    );
  } catch (error) {
    console.log(
      'STORAGE UPLOAD ERROR:',
      error
    );

    if (
      error?.code ===
      'storage/unknown'
    ) {
      throw new Error(
        'Firebase Storage could not process this upload. Make sure Storage is enabled for your Firebase project and that your .env storage bucket matches the Firebase console.'
      );
    }

    if (
      error?.code ===
      'storage/unauthorized'
    ) {
      throw new Error(
        'Firebase Storage denied this upload. Check your Storage security rules.'
      );
    }

    if (
      error?.code ===
      'storage/bucket-not-found'
    ) {
      throw new Error(
        'Firebase Storage bucket was not found. Check EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.'
      );
    }

    throw error;
  }
}

export async function uploadChoreProof({
  uri,
  householdId,
  userId,
  choreId,
}) {
  const extension =
    uri
      .split('.')
      .pop()
      ?.split('?')[0] ||
    'jpg';

  return uploadImage(
    uri,
    `proofs/${householdId}/${userId}/${choreId}-${Date.now()}.${extension}`
  );
}

export async function uploadProfilePhoto({
  uri,
  userId,
}) {
  const extension =
    uri
      .split('.')
      .pop()
      ?.split('?')[0] ||
    'jpg';

  return uploadImage(
    uri,
    `profiles/${userId}/profile-${Date.now()}.${extension}`
  );
}