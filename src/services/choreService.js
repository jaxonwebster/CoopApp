import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  format,
  startOfWeek,
} from 'date-fns';

import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';

// Keep concurrent screens from issuing the same household read more than
// once. This is intentionally an in-flight cache only: after a write finishes,
// the next read still goes to Firestore so the UI never relies on stale data.
const householdChoreRequests = new Map();
const recurringEnsureDates = new Map();
const recurringEnsureRequests = new Map();
const streakRefreshCache = new Map();
const streakRefreshRequests = new Map();
const STREAK_REFRESH_WINDOW_MS = 15000;


// ============================================================
// BASIC DATE HELPERS
// ============================================================

function todayKey() {
  // Use the device's LOCAL calendar date. toISOString() is UTC and can
  // make late-evening chores appear to belong to tomorrow.
  return format(new Date(), 'yyyy-MM-dd');
}

export function isRecurringScheduledOnDate(chore, key) {
  if (!chore?.recurring || !chore.assignedDate || key < chore.assignedDate) return false;
  if (chore.recurrenceEndDate && key > chore.recurrenceEndDate) return false;
  if (Array.isArray(chore.skippedDates) && chore.skippedDates.includes(key)) return false;
  if (chore.recurrence?.frequency === 'daily') return true;
  const weekday = new Date(`${key}T12:00:00`).getDay();
  const weekdays = Array.isArray(chore.recurrence?.weekdays) && chore.recurrence.weekdays.length
    ? chore.recurrence.weekdays
    : [new Date(`${chore.assignedDate}T12:00:00`).getDay()];
  return weekdays.includes(weekday);
}

export function choreScheduledOnDate(chore, key) {
  if (!chore) return false;
  // Each stored recurring document is one dated occurrence. The recurrence
  // rule is used for future schedule previews, not to make an old pending
  // occurrence appear again on later days.
  if (chore.recurring) return chore.assignedDate === key && isRecurringScheduledOnDate(chore, key);
  const start = chore.assignedDate || chore.dueDate;
  const end = chore.dueDate || start;
  return Boolean(start && end && start <= key && end >= key);
}

function isOptionalChore(chore) {
  return chore?.originallyAvailable === true
    || chore?.claimedFromOptional === true
    || chore?.openToAnyone === true
    || chore?.isAvailable === true
    || chore?.assignmentType === 'available';
}

function initialRecurringDate(recurrence) {
  if (!recurrence || recurrence.frequency === 'daily') return todayKey();

  const selectedDays = Array.isArray(recurrence.weekdays) && recurrence.weekdays.length
    ? recurrence.weekdays
    : [new Date().getDay()];
  const date = new Date();

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    if (selectedDays.includes(candidate.getDay())) return format(candidate, 'yyyy-MM-dd');
  }

  return todayKey();
}

// Ask the trusted backend to create today's occurrences. This keeps children
// from needing direct permission to create chore documents while ensuring a
// missed scheduled run does not hide a recurring chore from the household.
export async function ensureTodaysRecurringChores(householdId) {
  if (!householdId) return;

  const date = todayKey();
  if (recurringEnsureDates.get(householdId) === date) return;

  const existingRequest = recurringEnsureRequests.get(householdId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      await httpsCallable(functions, 'ensureRecurringChores')({ householdId });
      recurringEnsureDates.set(householdId, date);
    } catch (error) {
      // Reading chores should still work if the function has not been deployed
      // yet. The scheduled function remains the fallback generator.
      console.log('RECURRING CHORE ENSURE ERROR:', error?.message || error);
    } finally {
      recurringEnsureRequests.delete(householdId);
    }
  })();

  recurringEnsureRequests.set(householdId, request);
  return request;
}

export async function refreshFamilyStreak(householdId) {
  if (!householdId) return null;

  const cached = streakRefreshCache.get(householdId);
  if (cached && Date.now() - cached.at < STREAK_REFRESH_WINDOW_MS) {
    return cached.data;
  }

  const existingRequest = streakRefreshRequests.get(householdId);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      const result = await httpsCallable(functions, 'refreshStreak')({householdId});
      streakRefreshCache.set(householdId, {at: Date.now(), data: result.data});
      return result.data;
    } catch (error) {
      console.log('STREAK REFRESH ERROR:', error?.message || error);
      return null;
    } finally {
      streakRefreshRequests.delete(householdId);
    }
  })();

  streakRefreshRequests.set(householdId, request);
  return request;
}


// ============================================================
// GET ALL HOUSEHOLD CHORES
// ============================================================

function normalizeChoreSnapshot(snap) {
  const recurringByDate = new Map();
  const oneTime = [];
  const statusPriority = {
    completed: 5,
    awaitingApproval: 4,
    submitted: 3,
    pending: 2,
    excused: 1,
  };

  snap.docs.forEach((item) => {
    const data = item.data();
    if (data.isTemplate) return;

    const normalized = {
      id: item.id,
      ...data,
      // Backward compatibility for chores created before Round 13.
      assignedDate: data.assignedDate || data.dueDate || todayKey(),
      dueDate: data.recurring ? null : (data.dueDate || null),
    };

    if (!normalized.recurring) {
      oneTime.push(normalized);
      return;
    }

    const seriesId = normalized.seriesId || normalized.id;
    const key = `${seriesId}:${normalized.assignedDate}`;
    const existing = recurringByDate.get(key);
    if (!existing) {
      recurringByDate.set(key, normalized);
      return;
    }

    // Older data can contain two documents for the same recurring date. Keep
    // the most advanced state so a submitted occurrence cannot be replaced in
    // the UI by a stale pending duplicate after the listener refreshes.
    const existingPriority = statusPriority[existing.status] || 0;
    const nextPriority = statusPriority[normalized.status] || 0;
    const generatedId = `${seriesId}_${normalized.assignedDate}`;
    if (nextPriority > existingPriority || (nextPriority === existingPriority && normalized.id === generatedId)) {
      recurringByDate.set(key, normalized);
    }
  });

  return [...oneTime, ...recurringByDate.values()];
}

export async function getHouseholdChores(
  householdId
) {
  await ensureTodaysRecurringChores(householdId);

  const existingRequest = householdChoreRequests.get(householdId);
  if (existingRequest) return existingRequest;

  const q = query(
    collection(db, 'chores'),
    where(
      'householdId',
      '==',
      householdId
    )
  );

  const request = getDocs(q)
    .then((snap) => normalizeChoreSnapshot(snap))
    .finally(() => householdChoreRequests.delete(householdId));

  householdChoreRequests.set(householdId, request);
  return request;
}

export function subscribeToHouseholdChores(householdId, onChange, onError) {
  if (!householdId) return () => {};

  const q = query(
    collection(db, 'chores'),
    where('householdId', '==', householdId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snap) => onChange(normalizeChoreSnapshot(snap)),
    onError
  );

  // Start the once-per-local-day recurring generation check without delaying
  // the live listener's initial snapshot.
  ensureTodaysRecurringChores(householdId).catch(() => {});
  return unsubscribe;
}



export async function claimAvailableChore(choreId, profile, selectedDate = todayKey()) {
  if (!choreId || !profile?.id) throw new Error('Could not claim this chore.');
  const ref = doc(db, 'chores', choreId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This chore is no longer available.');
    const chore = snap.data();
    const isAvailable = chore.openToAnyone === true || chore.isAvailable === true || chore.assignmentType === 'available';
    if (!isAvailable || chore.assignedTo) throw new Error('Someone already picked up this chore.');

    const claimDate = selectedDate || chore.assignedDate || todayKey();

    // A recurring optional chore is a pool of one-day opportunities. Keep the
    // recurring source untouched so it remains available tomorrow, and create
    // a separate one-time claim for the selected day.
    if (chore.recurring) {
      const seriesId = chore.seriesId || choreId;
      const claimId = `${seriesId}_optional_claim_${claimDate}`;
      const claimRef = doc(db, 'chores', claimId);

      tx.set(claimRef, {
        householdId: chore.householdId,
        seriesId,
        title: chore.title,
        description: chore.description || '',
        points: Number(chore.points || 0),
        assignedDate: claimDate,
        dueDate: null,
        assignedTo: profile.id,
        assignedToName: profile.name || 'Family member',
        assignedToRole: profile.role || 'child',
        openToAnyone: false,
        originallyAvailable: true,
        claimedFromOptional: true,
        photoRequired: Boolean(chore.photoRequired),
        requiresApproval: Boolean(chore.requiresApproval),
        recurring: false,
        recurrence: null,
        status: 'pending',
        source: 'optionalClaim',
        createdBy: profile.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // One-time optional chores can use their existing document, but retain a
    // permanent marker so the calendar never adds a dot for them.
    tx.update(ref, {
      assignedTo: profile.id,
      assignedToName: profile.name || 'Family member',
      assignedToRole: profile.role || 'child',
      openToAnyone: false,
      originallyAvailable: true,
      claimedFromOptional: true,
      updatedAt: serverTimestamp(),
    });
  });
}

// ============================================================
// WEEKLY HISTORY CLEANUP
//
// Parents call this opportunistically when opening Home. Old occurrence
// records are removed once they fall before the current Monday. For a
// recurring series we keep one hidden template so future occurrences can
// still be generated without retaining visible history forever.
// ============================================================
export async function cleanupOldChoreHistory(householdId) {
  if (!householdId) return;
  const cutoff = format(startOfWeek(new Date(), {weekStartsOn: 1}), 'yyyy-MM-dd');
  const q = query(collection(db, 'chores'), where('householdId', '==', householdId));
  const snap = await getDocs(q);
  const rows = snap.docs.map((item) => ({ref: item.ref, id: item.id, ...item.data(), assignedDate: item.data().assignedDate || item.data().dueDate || ''}));
  const old = rows.filter((item) => item.assignedDate && item.assignedDate < cutoff);
  const keepRecurring = new Map();
  for (const item of old.filter((x) => x.recurring)) {
    const key = item.seriesId || item.id;
    const current = keepRecurring.get(key);
    if (!current || item.assignedDate > current.assignedDate) keepRecurring.set(key, item);
  }
  const keepIds = new Set([...keepRecurring.values()].map((x) => x.id));
  await Promise.all(old.map(async (item) => {
    if (keepIds.has(item.id)) {
      await updateDoc(item.ref, {isTemplate: true, updatedAt: serverTimestamp()});
    } else {
      await deleteDoc(item.ref);
    }
  }));
}

// ============================================================
// GET ONE CHORE
// ============================================================

export async function getChore(
  choreId
) {
  const snap =
    await getDoc(
      doc(
        db,
        'chores',
        choreId
      )
    );

  if (!snap.exists()) {
    throw new Error(
      'Chore not found.'
    );
  }

  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    assignedDate: data.assignedDate || data.dueDate || todayKey(),
    dueDate: data.recurring ? null : (data.dueDate || null),
  };
}


// ============================================================
// CREATE CHORE
//
// IMPORTANT:
//
// For recurring chores, the FIRST occurrence is created
// here. Future occurrences are created by the Firebase
// scheduled Cloud Function.
//
// That means opening the app is no longer responsible
// for generating recurring chores.
// ============================================================

export async function createChore(
  data
) {
  const choreRef =
    doc(
      collection(
        db,
        'chores'
      )
    );

  const seriesId =
    data.recurring
      ? choreRef.id
      : null;

  await setDoc(
    choreRef,
    {
      householdId:
        data.householdId,

      title:
        data.title,

      description:
        data.description ||
        '',

      points:
        Number(
          data.points || 0
        ),

      assignedDate:
        data.recurring ? initialRecurringDate(data.recurrence) : todayKey(),

      dueDate:
        data.recurring ? null : (data.dueDate || null),

      assignedTo:
        data.assignedTo,

      assignedToName:
        data.assignedToName ||
        '',

      assignedToRole:
        data.assignedToRole ||
        'child',

      // Optional jobs stay unassigned until one family member claims them.
      openToAnyone:
        Boolean(data.openToAnyone),

      // This remains true even after a one-time optional chore is claimed so
      // calendar indicators can distinguish it from a directly assigned chore.
      originallyAvailable:
        Boolean(data.openToAnyone),

      photoRequired:
        Boolean(
          data.photoRequired
        ),

      // Approval is OFF unless explicitly enabled.
      requiresApproval:
        Boolean(
          data.requiresApproval
        ),

      recurring:
        Boolean(
          data.recurring
        ),

      recurrence:
        data.recurring
          ? data.recurrence
          : null,

      // All occurrences in the same recurring
      // series share this value.
      seriesId,

      status:
        'pending',

      source:
        data.source ||
        'manual',

      createdBy:
        data.createdBy,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return choreRef.id;
}


// ============================================================
// UPDATE CHORE
// ============================================================

export async function updateChore(
  choreId,
  updates
) {
  const current = await getChore(choreId);

  // IMPORTANT: partial updates (for example, setting a reminder) must not
  // silently turn a recurring chore into a one-time chore.
  const hasRecurringUpdate =
    Object.prototype.hasOwnProperty.call(updates, 'recurring');

  const nextRecurring = hasRecurringUpdate
    ? Boolean(updates.recurring)
    : Boolean(current.recurring);

  const nextSeriesId = current.seriesId || (nextRecurring ? choreId : null);

  const payload = {
    ...updates,
    // Editing a chore should not move it to a different day.
    assignedDate: current.assignedDate || todayKey(),
    updatedAt: serverTimestamp(),
  };

  if (hasRecurringUpdate) {
    payload.recurring = nextRecurring;
    payload.recurrence = nextRecurring
      ? (updates.recurrence || current.recurrence || null)
      : null;
    payload.seriesId = nextSeriesId;
    payload.dueDate = nextRecurring
      ? null
      : (Object.prototype.hasOwnProperty.call(updates, 'dueDate') ? (updates.dueDate || null) : (current.dueDate || null));
  }

  if (!nextRecurring && !Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
    payload.dueDate = current.dueDate || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'requiresApproval')) {
    payload.requiresApproval = Boolean(updates.requiresApproval);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'openToAnyone')) {
    payload.originallyAvailable = Boolean(current.originallyAvailable || updates.openToAnyone);
  }

  await updateDoc(doc(db, 'chores', choreId), payload);
}

// Save a parent edit for one recurring occurrence without changing the
// recurring series. Future dates may be virtual (not yet stored), so this
// creates the deterministic dated occurrence document when needed.
export async function updateChoreOccurrence(choreId, occurrenceDate, updates) {
  if (!choreId || !occurrenceDate) throw new Error('Occurrence date is missing.');

  const source = await getChore(choreId);
  if (!source.recurring) return updateChore(choreId, updates);

  const seriesId = source.seriesId || source.id;
  const generatedId = `${seriesId}_${occurrenceDate}`;
  const generatedRef = doc(db, 'chores', generatedId);
  const sourceRef = doc(db, 'chores', source.id);
  const existingSnap = await getDoc(generatedRef);
  const sourceIsThisOccurrence = source.assignedDate === occurrenceDate && source.id !== generatedId;
  const targetRef = sourceIsThisOccurrence ? sourceRef : generatedRef;
  const targetSnap = sourceIsThisOccurrence ? await getDoc(sourceRef) : existingSnap;
  const existing = targetSnap.exists() ? targetSnap.data() : {};

  const payload = {
    ...source,
    ...existing,
    ...updates,
    householdId: source.householdId,
    seriesId,
    assignedDate: occurrenceDate,
    dueDate: null,
    recurring: true,
    recurrence: updates.recurrence || source.recurrence || null,
    source: existing.source || source.source || 'recurring',
    createdBy: existing.createdBy || source.createdBy,
    status: existing.status || 'pending',
    isTemplate: false,
    isOccurrenceOverride: true,
    updatedAt: serverTimestamp(),
  };
  delete payload.id;

  if (targetSnap.exists()) await updateDoc(targetRef, payload);
  else await setDoc(targetRef, {...payload, createdAt: serverTimestamp()});
  return targetRef.id;
}

// Delete only one recurring occurrence. A skipped-date marker on the series
// prevents the backend and the calendar preview from recreating that date.
export async function deleteChoreOccurrence(choreId, occurrenceDate) {
  if (!choreId || !occurrenceDate) throw new Error('Occurrence date is missing.');
  const source = await getChore(choreId);
  if (!source.recurring) return deleteChore(choreId);

  const seriesId = source.seriesId || source.id;
  const seriesSnap = await getDocs(query(
    collection(db, 'chores'),
    where('householdId', '==', source.householdId)
  ));
  const seriesSource = seriesSnap.docs
    .filter((item) => {
      const data = item.data();
      return (item.id === seriesId || data.seriesId === seriesId) && data.recurring === true;
    })
    .sort((a, b) => {
      if (a.id === seriesId) return -1;
      if (b.id === seriesId) return 1;
      return String(a.data().assignedDate || '').localeCompare(String(b.data().assignedDate || ''));
    })[0];

  if (!seriesSource) throw new Error('Recurring chore series not found.');

  // The series marker is the source of truth. Updating it first avoids a
  // permission failure on generated occurrence documents and prevents the
  // backend/calendar from recreating the deleted date.
  const seriesData = seriesSource.data();
  const dates = Array.from(new Set([...(seriesData.skippedDates || []), occurrenceDate]));
  await updateDoc(seriesSource.ref, {skippedDates: dates, updatedAt: serverTimestamp()});

  // Physical deletion is best effort. Some older occurrence documents have
  // legacy ownership fields, but the series marker above still hides them and
  // permanently prevents recreation.
  const occurrenceRef = doc(db, 'chores', `${seriesId}_${occurrenceDate}`);
  if (occurrenceRef.id !== seriesSource.id) {
    try {
      await deleteDoc(occurrenceRef);
    } catch (err) {
      if (err?.code !== 'permission-denied') throw err;
    }
  }
}

function previousDateKey(value) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return format(date, 'yyyy-MM-dd');
}

// Stop a recurring series before one selected date and remove only that
// occurrence plus later occurrences. Earlier history and the series definition
// remain available for records and streak calculations.
export async function deleteFutureChoreOccurrences(choreId, occurrenceDate) {
  if (!choreId || !occurrenceDate) throw new Error('Occurrence date is missing.');
  const source = await getChore(choreId);
  if (!source.recurring) return deleteChore(choreId);

  const seriesId = source.seriesId || source.id;
  const allSnap = await getDocs(query(
    collection(db, 'chores'),
    where('householdId', '==', source.householdId)
  ));
  const seriesDocs = allSnap.docs.filter((item) => {
    const data = item.data();
    return item.id === seriesId || data.seriesId === seriesId;
  });
  const root = seriesDocs
    .filter((item) => item.id === seriesId || item.data().isTemplate === true)
    .sort((a, b) => String(a.data().assignedDate || '').localeCompare(String(b.data().assignedDate || '')))[0]
    || seriesDocs.slice().sort((a, b) => String(a.data().assignedDate || '').localeCompare(String(b.data().assignedDate || '')))[0];
  if (!root) throw new Error('Recurring chore series not found.');

  await Promise.all(seriesDocs
    .filter((item) => item.id !== root.id && String(item.data().assignedDate || '') >= occurrenceDate)
    .map((item) => deleteDoc(item.ref)));
  await updateDoc(root.ref, {
    recurrenceEndDate: previousDateKey(occurrenceDate),
    updatedAt: serverTimestamp(),
  });
}


// ============================================================
// DELETE CHORE
// ============================================================

export async function deleteChore(
  choreId
) {
  if (!choreId) throw new Error('Chore ID is missing.');

  const choreRef = doc(db, 'chores', choreId);
  const choreSnap = await getDoc(choreRef);
  if (!choreSnap.exists()) throw new Error('Chore not found.');

  const chore = choreSnap.data();

  // Lock completed/missed history before removing an old occurrence. This
  // prevents deleting a past chore from changing a historical streak or day
  // color. Today's work remains live and can still affect today's progress.
  if (chore.householdId) {
    await refreshHouseholdStreak(chore.householdId);
  }

  if (!chore.recurring) {
    await deleteDoc(choreRef);
    return;
  }

  // A recurring chore is stored as a series of dated occurrences plus a
  // retained template. Delete the entire series so the backend cannot use an
  // older occurrence to generate the chore again tomorrow.
  const seriesId = chore.seriesId || choreId;
  const seriesQuery = query(
    collection(db, 'chores'),
    where('householdId', '==', chore.householdId)
  );
  const seriesSnap = await getDocs(seriesQuery);
  const seriesDocs = seriesSnap.docs.filter((item) => {
    const data = item.data();
    return item.id === choreId || data.seriesId === seriesId;
  });

  await Promise.all(seriesDocs.map((item) => deleteDoc(item.ref)));
}


// ============================================================
// SUBMIT / COMPLETE CHORE
//
// Approval ON:
//   pending -> awaitingApproval
//
// Approval OFF:
//   pending -> completed
//   points awarded immediately
//
// Home Reset chores already have:
//   requiresApproval: false
//   points: 1
// ============================================================

function callableUnavailable(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code.includes('not-found') || code.includes('unavailable') || message.includes('[404]');
}

async function submitChoreDirect({choreId, photoUrl = null}) {
  const choreRef = doc(db, 'chores', choreId);
  return runTransaction(db, async (tx) => {
    const choreSnap = await tx.get(choreRef);
    if (!choreSnap.exists()) throw new Error('Chore not found.');
    const chore = choreSnap.data();
    if (chore.status !== 'pending') throw new Error('This chore was already submitted.');
    if (chore.recurring && chore.assignedDate !== todayKey()) {
      throw new Error('Recurring chores can only be completed on their scheduled day.');
    }
    if (chore.requiresApproval) {
      tx.update(choreRef, {status: 'awaitingApproval', proofPhotoUrl: photoUrl, submittedAt: serverTimestamp(), updatedAt: serverTimestamp()});
      return {status: 'awaitingApproval', householdId: chore.householdId};
    }
    const userRef = doc(db, 'users', chore.assignedTo);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('Assigned user not found.');
    tx.update(userRef, {points: Number(userSnap.data().points || 0) + Number(chore.points || 0), updatedAt: serverTimestamp()});
    tx.update(choreRef, {status: 'completed', proofPhotoUrl: photoUrl, submittedAt: serverTimestamp(), completedAt: serverTimestamp(), updatedAt: serverTimestamp()});
    return {status: 'completed', householdId: chore.householdId};
  });
}

async function refreshHouseholdStreak(householdId) {
  if (!householdId) return;
  const today = todayKey();
  const all = await getHouseholdChores(householdId);
  const streakChores = all.filter((chore) => !chore.isTemplate && chore.assignedTo && !isOptionalChore(chore) && chore.source !== 'homeReset' && chore.status !== 'excused');
  const dateForStreak = (chore) => chore.recurring ? chore.assignedDate : (chore.dueDate || chore.assignedDate);
  const days = Array.from(new Set(streakChores.map(dateForStreak).filter((date) => date && date <= today))).sort().reverse();
  const choresByDate = new Map();
  const choresByUser = new Map();
  streakChores.forEach((chore) => {
    const date = dateForStreak(chore);
    if (!date) return;
    if (!choresByDate.has(date)) choresByDate.set(date, []);
    choresByDate.get(date).push(chore);
    if (!choresByUser.has(chore.assignedTo)) choresByUser.set(chore.assignedTo, []);
    choresByUser.get(chore.assignedTo).push(chore);
  });
  const householdRef = doc(db, 'households', householdId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdRef);
    if (!snap.exists()) return;
    const household = snap.data();
    const lockedDays = {...(household.streakDayStatus || {})};
    const lockedDaysByUser = {...(household.streakDayStatusByUser || {})};

    // Once a day is over, preserve its result. Future deletes/edits cannot
    // rewrite that historical day.
    days.filter((date) => date < today).forEach((date) => {
      if (!Object.prototype.hasOwnProperty.call(lockedDays, date)) {
        const dayChores = choresByDate.get(date) || [];
        lockedDays[date] = dayChores.length > 0 && dayChores.every((chore) => chore.status === 'completed');
      }
    });

    choresByUser.forEach((userChores, userId) => {
      const userLockedDays = {...(lockedDaysByUser[userId] || {})};
      const userDates = new Set(userChores.map(dateForStreak).filter(Boolean));
      userDates.forEach((date) => {
        if (date >= today || Object.prototype.hasOwnProperty.call(userLockedDays, date)) return;
        const dayChores = userChores.filter((chore) => dateForStreak(chore) === date);
        userLockedDays[date] = dayChores.length > 0 && dayChores.every((chore) => chore.status === 'completed');
      });
      lockedDaysByUser[userId] = userLockedDays;
    });

    const evaluationDates = Array.from(new Set([
      ...days,
      ...Object.keys(lockedDays).filter((date) => date <= today),
    ])).sort().reverse();
    if (!choresByDate.get(today)?.length) {
      const todayIndex = evaluationDates.indexOf(today);
      if (todayIndex >= 0) evaluationDates.splice(todayIndex, 1);
    }

    let streak = 0;
    for (const date of evaluationDates) {
      const dayChores = choresByDate.get(date) || [];
      const complete = date < today
        ? lockedDays[date] === true
        : dayChores.length > 0 && dayChores.every((chore) => chore.status === 'completed');
      if (!complete) break;
      streak += 1;
    }

    tx.update(householdRef, {
      streak,
      streakDayStatus: lockedDays,
      streakDayStatusByUser: lockedDaysByUser,
      lastStreakDate: today,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function submitChore({choreId, photoUrl = null}) {
  const result = await submitChoreDirect({choreId, photoUrl});
  if (result.status === 'completed') await refreshHouseholdStreak(result.householdId);
  return result;
}

async function reviewChoreDirect(choreId, decision, note = '') {
  const choreRef = doc(db, 'chores', choreId);
  return runTransaction(db, async (tx) => {
    const choreSnap = await tx.get(choreRef);
    if (!choreSnap.exists()) throw new Error('Chore not found.');
    const chore = choreSnap.data();
    if (chore.status !== 'awaitingApproval') throw new Error('This chore is not waiting for approval.');
    if (decision === 'rejected') {
      tx.update(choreRef, {
        status: 'pending',
        rejectionNote: note,
        proofPhotoUrl: null,
        submittedAt: null,
        approvedAt: null,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
      return {status: 'pending'};
    }
    const userRef = doc(db, 'users', chore.assignedTo);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('Assigned user not found.');
    tx.update(userRef, {points: Number(userSnap.data().points || 0) + Number(chore.points || 0), updatedAt: serverTimestamp()});
    tx.update(choreRef, {status: 'completed', approvedAt: serverTimestamp(), completedAt: serverTimestamp(), updatedAt: serverTimestamp()});
    return {status: 'completed', householdId: chore.householdId};
  });
}

export async function approveChore(choreId) {
  const result = await reviewChoreDirect(choreId, 'approved');
  if (result.status === 'completed') await refreshHouseholdStreak(result.householdId);
  return result;
}

export async function rejectChore(choreId, note = '') {
  return reviewChoreDirect(choreId, 'rejected', note);
}

// ============================================================
// MISSED CHORE
//
// A chore is missed when:
//
//   status === pending
//   assignedDate is before today
//
// Completed and awaiting-approval chores are NOT treated
// as missed.
// ============================================================

export function isMissedChore(
  chore
) {
  if (isOptionalChore(chore) && !chore.assignedTo) return false;
  return (
    chore.status ===
      'pending' &&
    !!(chore.dueDate || chore.assignedDate) &&
    (chore.dueDate || chore.assignedDate) <
      todayKey()
  );
}

export async function reassignMissedChore(choreId) {
  const today = todayKey();
  const choreRef = doc(db, 'chores', choreId);
  const choreSnap = await getDoc(choreRef);
  if (!choreSnap.exists()) throw new Error('Chore not found.');

  const chore = choreSnap.data();

  // A recurring occurrence should be rescheduled only once. Turning the old
  // occurrence into a new recurring item would move the series forward and
  // could make it appear again on the next scheduled date. Excuse the old
  // occurrence, then create a one-time chore for today instead.
  if (chore.recurring) {
    const replacementRef = doc(collection(db, 'chores'));
    await runTransaction(db, async (tx) => {
      const currentSnap = await tx.get(choreRef);
      if (!currentSnap.exists()) throw new Error('Chore not found.');
      const current = currentSnap.data();

      tx.update(choreRef, {
        status: 'excused',
        excusedReason: 'reassignedMissedOccurrence',
        reassignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(replacementRef, {
        householdId: current.householdId,
        title: current.title,
        description: current.description || '',
        points: Number(current.points || 0),
        assignedDate: today,
        dueDate: today,
        assignedTo: current.assignedTo || null,
        assignedToName: current.assignedToName || '',
        assignedToRole: current.assignedToRole || 'child',
        openToAnyone: false,
        originallyAvailable: false,
        photoRequired: Boolean(current.photoRequired),
        requiresApproval: Boolean(current.requiresApproval),
        recurring: false,
        recurrence: null,
        seriesId: null,
        isTemplate: false,
        status: 'pending',
        source: 'reassignedMissed',
        createdBy: current.createdBy,
        reassignedFrom: choreId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await refreshHouseholdStreak(chore.householdId);
    return replacementRef.id;
  }

  await updateDoc(choreRef, {
    assignedDate: today,
    dueDate: today,
    status: 'pending',
    rejectionNote: '',
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    proofPhotoUrl: null,
    updatedAt: serverTimestamp(),
  });
  await refreshHouseholdStreak(chore.householdId);
}

export async function dismissMissedChore(choreId) {
  if (!choreId) throw new Error('Chore ID is missing.');
  const choreRef = doc(db, 'chores', choreId);
  const choreSnap = await getDoc(choreRef);
  if (!choreSnap.exists()) throw new Error('Chore not found.');

  const chore = choreSnap.data();
  await updateDoc(choreRef, {
    status: 'excused',
    excusedReason: 'missedDismissed',
    dismissedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await refreshHouseholdStreak(chore.householdId);
}


// ============================================================
// GET CHORES FOR A SPECIFIC DATE
// ============================================================

export function getChoresForDate(
  chores,
  date
) {
  const key =
    format(
      date,
      'yyyy-MM-dd'
    );

  return chores.filter((chore) => choreScheduledOnDate(chore, key));
}


// ============================================================
// GET TODAY'S CHORES
// ============================================================

export function getTodaysChores(
  chores
) {
  const today =
    todayKey();

  return chores.filter(
    (chore) =>
      chore.assignedDate ===
      today
  );
}


// ============================================================
// GET ACTIVE CHORES
//
// Past pending chores are intentionally excluded.
//
// Parents can find them through Missed Chores.
// ============================================================

export function getActiveChores(
  chores
) {
  const today =
    todayKey();

  return chores.filter(
    (chore) =>
      (
        !chore.assignedDate ||
        chore.assignedDate >=
          today
      ) &&
      chore.status !==
        'completed'
  );
}


// ============================================================
// GET COMPLETED CHORES FOR TODAY
// ============================================================

export function getCompletedTodayChores(
  chores
) {
  const today =
    todayKey();

  return chores.filter(
    (chore) =>
      chore.status ===
        'completed' &&
      (
        !chore.assignedDate ||
        chore.assignedTo && chore.assignedDate ===
          today
      )
  );
}


// ============================================================
// GET MISSED HOUSEHOLD CHORES
// ============================================================

export function getMissedChores(
  chores
) {
  return chores.filter(
    isMissedChore
  );
}


// ============================================================
// UPDATE FAMILY STREAK
//
// Home Reset chores do not count toward the household
// streak because they are extra/quick tasks rather than
// scheduled household responsibilities.
// ============================================================

async function updateFamilyStreakIfComplete(
  householdId
) {
  const all =
    await getHouseholdChores(
      householdId
    );

  const today =
    todayKey();

  const todays =
    all.filter(
      (chore) =>
        chore.assignedTo &&
        chore.assignedDate ===
          today &&
        chore.source !==
          'homeReset' &&
        chore.status !==
          'excused'
    );

  if (!todays.length) {
    return;
  }

  const allComplete =
    todays.every(
      (chore) =>
        chore.status ===
        'completed'
    );

  if (!allComplete) {
    return;
  }

  const canContinue = (lastStreakDate) => {
    if (!lastStreakDate) return false;
    const datesBetween = new Set(
      all
        .filter((chore) => chore.assignedTo && chore.source !== 'homeReset' && chore.status !== 'excused' && chore.assignedDate > lastStreakDate && chore.assignedDate < today)
        .map((chore) => chore.assignedDate)
    );
    return Array.from(datesBetween).every((date) =>
      all.filter((chore) => chore.assignedTo && chore.assignedDate === date && chore.source !== 'homeReset' && chore.status !== 'excused')
        .every((chore) => chore.status === 'completed')
    );
  };

  const householdRef =
    doc(
      db,
      'households',
      householdId
    );

  await runTransaction(
    db,
    async (transaction) => {
      const householdSnap =
        await transaction.get(
          householdRef
        );

      if (
        !householdSnap.exists()
      ) {
        return;
      }

      const household =
        householdSnap.data();

      // Don't increment twice on the same day.
      if (
        household.lastStreakDate ===
        today
      ) {
        return;
      }

      transaction.update(
        householdRef,
        {
          streak: canContinue(household.lastStreakDate)
            ? Number(household.streak || 0) + 1
            : 1,

          lastStreakDate:
            today,

          updatedAt:
            serverTimestamp(),
        }
      );
    }
  );
}
