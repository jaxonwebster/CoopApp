import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db, auth, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

// Several screens can request the same family list while a navigation
// transition is in progress. Share only the active request; completed reads
// are never cached, so family changes still appear normally on the next load.
const familyMemberRequests = new Map();

export async function getUserProfile(
  uid
) {
  const snap =
    await getDoc(
      doc(
        db,
        'users',
        uid
      )
    );

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function updateUserProfile(
  userId,
  updates
) {
  await updateDoc(
    doc(
      db,
      'users',
      userId
    ),
    {
      ...updates,
      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function getHousehold(
  householdId
) {
  const snap =
    await getDoc(
      doc(
        db,
        'households',
        householdId
      )
    );

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function getFamilyMembers(
  householdId
) {
  if (!householdId) return [];

  const existingRequest = familyMemberRequests.get(householdId);
  if (existingRequest) return existingRequest;

  const q = query(
    collection(db, 'users'),
    where(
      'householdId',
      '==',
      householdId
    )
  );

  const request = getDocs(q)
    .then((snap) => snap.docs.map(
      (item) => ({
        id: item.id,
        ...item.data(),
      })
    ))
    .finally(() => familyMemberRequests.delete(householdId));

  familyMemberRequests.set(householdId, request);
  return request;
}

export async function setAvailability(
  userId,
  isAvailable,
  sickUntil = null
) {
  await updateDoc(
    doc(
      db,
      'users',
      userId
    ),
    {
      isAvailable,
      sickUntil:
        isAvailable
          ? null
          : sickUntil,
      updatedAt:
        serverTimestamp(),
    }
  );

  if (!isAvailable) {
    const userSnap = await getDoc(doc(db, 'users', userId));
    const householdId = userSnap.data()?.householdId;
    if (householdId) {
      const pending = await getDocs(query(
        collection(db, 'chores'),
        where('householdId', '==', householdId),
        where('assignedTo', '==', userId)
      ));
      const batch = writeBatch(db);
      pending.docs.forEach((item) => {
        if (item.data().status === 'pending') {
          batch.update(item.ref, {
            status: 'excused',
            excusedReason: 'sickMode',
            updatedAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
    }
  }
}

export async function startHomeReset({
  householdId,
  parentId,
  tasks,
  children,
}) {
  const availableChildren =
    children.filter(
      (child) =>
        child.isAvailable !==
        false
    );

  if (
    !availableChildren.length
  ) {
    throw new Error(
      'No available family members are selected.'
    );
  }

  if (!tasks.length) {
    throw new Error(
      'Choose at least one reset task.'
    );
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const batch =
    writeBatch(db);
  const recipientIds = new Set();

  tasks.forEach(
    (
      taskName,
      index
    ) => {
      const child =
        availableChildren[
          index %
            availableChildren.length
        ];
      recipientIds.add(child.id);

      const choreRef =
        doc(
          collection(
            db,
            'chores'
          )
        );

      batch.set(
        choreRef,
        {
          title:
            taskName,

          description:
            'Quick Cleanup task',

          householdId,

          assignedTo:
            child.id,

          assignedToName:
            child.name,

          assignedToRole:
            child.role,

          // Always one point.
          points: 1,

          assignedDate:
            today,

          recurring: false,

          recurrence: null,

          photoRequired:
            false,

          // Never requires approval.
          requiresApproval:
            false,

          status:
            'pending',

          source:
            'homeReset',

          createdBy:
            parentId,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );
    }
  );

  await batch.commit();
  try {
    await httpsCallable(functions, 'notifyQuickCleanup')({
      householdId,
      recipientIds: Array.from(recipientIds),
      count: tasks.length,
    });
  } catch (error) {
    // Chore creation succeeded; a missing/un-deployed notification function
    // must not make Quick Cleanup look like it failed.
    console.log('QUICK CLEANUP NOTIFICATION ERROR:', error?.message || error);
  }
  return {recipientIds: Array.from(recipientIds), count: tasks.length};
}

export async function savePushToken(
  userId,
  token
) {
  if (!token) {
    return;
  }

  await updateDoc(
    doc(
      db,
      'users',
      userId
    ),
    {
      expoPushToken:
        token,
      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function sendPatOnBack({householdId, recipientId, senderName}) {
  if (!householdId || !recipientId || !senderName) throw new Error('Family member is required.');
  const senderId = auth.currentUser?.uid || null;
  if (!senderId) throw new Error('Sign in to send encouragement.');
  if (senderId === recipientId) throw new Error('Choose another family member.');
  await addDoc(collection(db, 'notifications'), {
    householdId,
    recipientId,
    senderId,
    type: 'patOnBack',
    notificationKey: 'patOnBack',
    body: `${senderName} says good job on your chores!`,
    read: false,
    createdAt: serverTimestamp(),
  });
}


export async function removeChildFromFamily(childId) {
  if (!childId) throw new Error('Child ID is required.');
  const result = await httpsCallable(functions, 'removeChildFromFamily')({childId});
  return result.data;
}
