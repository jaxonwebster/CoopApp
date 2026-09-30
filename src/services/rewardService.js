import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  db,
  auth,
  functions,
} from '../firebase/config';

import { httpsCallable } from 'firebase/functions';


// ============================================================
// GET ALL REWARDS
// ============================================================

export async function getRewards(householdId) {
  if (!householdId) throw new Error('Household could not be determined.');
  const rewardsQ = query(collection(db, 'rewards'), where('householdId', '==', householdId));
  const contributionsQ = query(collection(db, 'contributions'), where('householdId', '==', householdId));
  const [rewardSnap, contributionSnap] = await Promise.all([getDocs(rewardsQ), getDocs(contributionsQ)]);
  const totals = {};
  contributionSnap.docs.forEach((item) => {
    const data = item.data();
    totals[data.rewardId] = (totals[data.rewardId] || 0) + Number(data.amount || 0);
  });
  const rewards = rewardSnap.docs.map((item) => {
    const data = item.data();
    // Contributions are the source of truth for new donations. Keep legacy sharedPoints
    // when it is larger so existing family-goal progress is never lost.
    return {id: item.id, ...data, sharedPoints: Math.max(Number(data.sharedPoints || 0), Number(totals[item.id] || 0))};
  });

  // A daily reward is one reusable reward definition. Older versions could
  // create the same daily reward more than once, so hide duplicate definitions
  // by household/name while keeping the newest record.
  const seenDailyNames = new Set();
  return rewards
    .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0))
    .filter((reward) => {
      if (!(reward.dailyPrivilege || reward.limitPerDay)) return true;
      const key = String(reward.name || '').trim().toLowerCase();
      if (!key || seenDailyNames.has(key)) return false;
      seenDailyNames.add(key);
      return true;
    });
}


// ============================================================
// GET ONE REWARD
// ============================================================

export async function getReward(
  rewardId
) {
  if (!rewardId) {
    throw new Error(
      'Reward ID is missing.'
    );
  }

  const snap =
    await getDoc(
      doc(
        db,
        'rewards',
        rewardId
      )
    );

  if (!snap.exists()) {
    throw new Error(
      'Reward not found.'
    );
  }

  return {
    id: snap.id,
    ...snap.data(),
  };
}


// ============================================================
// GET ALL HOUSEHOLD REDEMPTIONS
// ============================================================

export async function getHouseholdRedemptions(
  householdId
) {
  if (!householdId) {
    throw new Error(
      'Household could not be determined.'
    );
  }

  const q = query(
    collection(
      db,
      'redemptions'
    ),
    where(
      'householdId',
      '==',
      householdId
    )
  );

  const snap =
    await getDocs(q);

  return snap.docs
    .map(
      (item) => ({
        id: item.id,
        ...item.data(),
      })
    )
    .sort(
      (a, b) =>
        Number(
          b.createdAt?.seconds ||
            0
        ) -
        Number(
          a.createdAt?.seconds ||
            0
        )
    );
}


// ============================================================
// GET REDEMPTIONS FOR ONE USER
// ============================================================

export async function getUserRedemptions(
  householdId,
  userId
) {
  if (
    !householdId ||
    !userId
  ) {
    throw new Error(
      'Household and user are required.'
    );
  }

  const q = query(
    collection(
      db,
      'redemptions'
    ),
    where(
      'householdId',
      '==',
      householdId
    ),
    where(
      'userId',
      '==',
      userId
    )
  );

  const snap =
    await getDocs(q);

  return snap.docs
    .map(
      (item) => ({
        id: item.id,
        ...item.data(),
      })
    )
    .sort(
      (a, b) =>
        Number(
          b.createdAt?.seconds ||
            0
        ) -
        Number(
          a.createdAt?.seconds ||
            0
        )
    );
}


// ============================================================
// GET PENDING REDEMPTIONS
//
// This is used by the parent Approval screen.
//
// IMPORTANT:
// We only query householdId here and filter status in JS.
// That avoids requiring a composite Firestore index.
// ============================================================

export async function getPendingRedemptions(
  householdId
) {
  const all =
    await getHouseholdRedemptions(
      householdId
    );

  return all.filter(
    (item) =>
      item.status ===
      'pending'
  );
}


// ============================================================
// CREATE REWARD
// ============================================================

export async function createReward(
  data
) {
  if (!data?.householdId) {
    throw new Error(
      'Household is required.'
    );
  }

  if (
    !data?.name?.trim()
  ) {
    throw new Error(
      'Reward name is required.'
    );
  }

  const isFamilyReward =
    Boolean(
      data.isFamilyReward
    );

  // Do not create another daily reward with the same name. Reuse the existing
  // definition so the reward remains available each day without duplicates.
  if (!isFamilyReward && data.dailyPrivilege) {
    const existingQuery = query(
      collection(db, 'rewards'),
      where('householdId', '==', data.householdId)
    );
    const existingSnap = await getDocs(existingQuery);
    const existing = existingSnap.docs
      .map((item) => ({id: item.id, ...item.data()}))
      .find((item) =>
        Boolean(item.dailyPrivilege || item.limitPerDay) &&
        String(item.name || '').trim().toLowerCase() === data.name.trim().toLowerCase()
      );

    if (existing) {
      await updateDoc(doc(db, 'rewards', existing.id), {
        ...data,
        name: data.name.trim(),
        type: 'individual',
        isFamilyReward: false,
        cost: Number(data.cost || 0),
        availability: data.availability || 'all',
        assignedTo: data.assignedTo || null,
        assignedToIds: Array.isArray(data.assignedToIds) ? data.assignedToIds : (data.assignedTo ? [data.assignedTo] : []),
        assignedToName: data.assignedToName || '',
        assignedToNames: Array.isArray(data.assignedToNames) ? data.assignedToNames : (data.assignedToName ? [data.assignedToName] : []),
        dailyPrivilege: true,
        limitPerDay: true,
        recurring: Boolean(data.recurring),
        recurrence: data.recurring ? (data.recurrence || {frequency: 'daily'}) : null,
        privilegeDurationHours: data.privilegeDurationHours ? Number(data.privilegeDurationHours) : null,
        updatedAt: serverTimestamp(),
      });
      return existing.id;
    }
  }

  const ref =
    await addDoc(
      collection(
        db,
        'rewards'
      ),
      {
        ...data,

        name:
          data.name.trim(),

        type:
          isFamilyReward
            ? 'family'
            : 'individual',

        isFamilyReward,

        cost:
          Number(
            data.cost ||
              0
          ),

        goal:
          Number(
            data.goal ||
              data.cost ||
              0
          ),

        sharedPoints:
          Number(
            data.sharedPoints ||
              0
          ),

        availability:
          isFamilyReward
            ? null
            : (
                data.availability ||
                'all'
              ),

        assignedTo: isFamilyReward ? null : (data.assignedTo || null),
        assignedToIds: isFamilyReward ? [] : (Array.isArray(data.assignedToIds) ? data.assignedToIds : (data.assignedTo ? [data.assignedTo] : [])),
        assignedToName: isFamilyReward ? '' : (data.assignedToName || ''),
        assignedToNames: isFamilyReward ? [] : (Array.isArray(data.assignedToNames) ? data.assignedToNames : (data.assignedToName ? [data.assignedToName] : [])),

        dailyPrivilege: isFamilyReward ? false : Boolean(data.dailyPrivilege),
        limitPerDay: isFamilyReward ? false : Boolean(data.dailyPrivilege || data.limitPerDay),
        recurring: isFamilyReward ? false : Boolean(data.recurring),
        recurrence: isFamilyReward || !data.recurring ? null : (data.recurrence || {frequency: 'daily'}),
        privilegeDurationHours: isFamilyReward || !data.privilegeDurationHours ? null : Number(data.privilegeDurationHours),

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  return ref.id;
}


// ============================================================
// UPDATE REWARD
// ============================================================

export async function updateReward(
  rewardId,
  updates
) {
  if (!rewardId) {
    throw new Error(
      'Reward ID is missing.'
    );
  }

  await updateDoc(
    doc(
      db,
      'rewards',
      rewardId
    ),
    {
      ...updates,

      updatedAt:
        serverTimestamp(),
    }
  );
}

export function isRewardAvailableToday(reward) {
  if (!reward || reward.availability === 'first') return true;
  if (!reward.recurring || !reward.recurrence || reward.recurrence.frequency === 'daily') return true;
  const weekdays = Array.isArray(reward.recurrence.weekdays) ? reward.recurrence.weekdays : [];
  return !weekdays.length || weekdays.includes(new Date().getDay());
}


// ============================================================
// DELETE REWARD
// ============================================================

export async function deleteReward(
  rewardId
) {
  if (!rewardId) {
    throw new Error(
      'Reward ID is missing.'
    );
  }

  await deleteDoc(
    doc(
      db,
      'rewards',
      rewardId
    )
  );
}


// ============================================================
// REDEEM INDIVIDUAL REWARD
// ============================================================

function localTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
}

export function isPrivilegeActive(item) {
  if (!item || item.status === 'rejected') return false;

  const storedExpiresAt = timestampMillis(item.privilegeExpiresAt);
  const redeemedAt = timestampMillis(item.redeemedAt || item.createdAt);
  const durationHours = Number(item.privilegeDurationHours || 0);
  const expiresAt = storedExpiresAt || (redeemedAt && durationHours > 0
    ? redeemedAt + durationHours * 60 * 60 * 1000
    : 0);
  if (expiresAt) return Date.now() < expiresAt;

  if (!(item.dailyPrivilege || item.limitPerDay)) return true;
  return item.redeemedDate === localTodayKey();
}

export async function requestReward({reward, user}) {
  if (!reward?.id) throw new Error('Reward ID is missing.');
  if (!user?.id) throw new Error('User ID is missing.');
  const result = await httpsCallable(functions, 'redeemReward')({rewardId: reward.id});
  return result.data?.redemptionId || result.data;
}

export async function approveRedemption(redemptionId) {
  const result = await httpsCallable(functions, 'reviewRedemption')({redemptionId, decision: 'approved'});
  return result.data;
}

export async function rejectRedemption(redemptionId) {
  const result = await httpsCallable(functions, 'reviewRedemption')({redemptionId, decision: 'rejected'});
  return result.data;
}


export async function removePrivilege(redemption) {
  if (!redemption?.id) throw new Error('Reward record not found.');
  await deleteDoc(doc(db, 'redemptions', redemption.id));
  if (redemption.claimId) {
    try { await deleteDoc(doc(db, 'rewardClaims', redemption.claimId)); } catch (_) {}
  }
}

// ============================================================
// FAMILY REWARD CONTRIBUTION
// ============================================================

export async function contributeToFamilyReward({rewardId, amount}) {
  const contribution = Number(amount);
  const uid = auth.currentUser?.uid;

  if (!uid || !rewardId || !Number.isInteger(contribution) || contribution <= 0) {
    throw new Error('Choose a valid amount.');
  }

  const userRef = doc(db, 'users', uid);
  const rewardRef = doc(db, 'rewards', rewardId);
  const contributionRef = doc(collection(db, 'contributions'));

  return runTransaction(db, async (tx) => {
    const [userSnap, rewardSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(rewardRef),
    ]);

    if (!userSnap.exists() || !rewardSnap.exists()) {
      throw new Error('Profile or family reward not found.');
    }

    const user = userSnap.data();
    const reward = rewardSnap.data();
    const points = Number(user.points || 0);
    const goal = Number(reward.goal || reward.cost || 0);

    if (user.householdId !== reward.householdId) {
      throw new Error('That reward is not in your household.');
    }

    if (!(reward.isFamilyReward === true || reward.type === 'family')) {
      throw new Error('This is not a family reward.');
    }

    if (points < contribution) {
      throw new Error('Not enough points.');
    }

    tx.update(userRef, {
      points: points - contribution,
      updatedAt: serverTimestamp(),
    });

    tx.set(contributionRef, {
      householdId: user.householdId,
      rewardId,
      userId: uid,
      amount: contribution,
      createdAt: serverTimestamp(),
    });

    return {
      amount: contribution,
      userPoints: points - contribution,
      goal,
    };
  });
}
