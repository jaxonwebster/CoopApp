const {
  onSchedule,
} = require(
  'firebase-functions/v2/scheduler'
);

const {
  onDocumentCreated,
  onDocumentUpdated,
} = require(
  'firebase-functions/v2/firestore'
);

const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require(
  'firebase-admin/firestore'
);

const {
  initializeApp,
} = require(
  'firebase-admin/app'
);

const {
  logger,
} = require(
  'firebase-functions'
);

initializeApp();

const db =
  getFirestore();

const TIME_ZONE =
  'America/Denver';


// ============================================================
// DATE HELPERS
// ============================================================

function dateFromKey(
  key
) {
  const [
    year,
    month,
    day,
  ] =
    key
      .split('-')
      .map(
        Number
      );

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0
  );
}

function dateKey(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}

function addDays(
  date,
  amount
) {
  const next =
    new Date(
      date
    );

  next.setDate(
    next.getDate() +
      amount
  );

  return next;
}

function recurrenceIncludesDateForKey(
  startKey,
  recurrence,
  targetKey,
  endKey = null
) {
  if (!startKey || targetKey < startKey) return false;
  if (endKey && targetKey > endKey) return false;
  const rule = recurrence || {frequency: 'daily'};
  if (rule.frequency === 'daily') return true;

  const weekdays = Array.isArray(rule.weekdays) && rule.weekdays.length
    ? rule.weekdays
    : [dateFromKey(startKey).getDay()];

  return weekdays.includes(dateFromKey(targetKey).getDay());
}

function isOptionalChore(chore) {
  return chore?.originallyAvailable === true
    || chore?.claimedFromOptional === true
    || chore?.openToAnyone === true
    || chore?.isAvailable === true
    || chore?.assignmentType === 'available';
}

function isUnclaimedOptionalChore(chore) {
  return isOptionalChore(chore) && !chore?.assignedTo;
}

async function ensureRecurringChoresForHousehold(householdId) {
  const today = localDateKey();
  const snapshot = await db.collection('chores')
    .where('householdId', '==', householdId)
    .get();

  const chores = snapshot.docs.map((document) => ({id: document.id, ref: document.ref, ...document.data()}));
  const templates = new Map();
  const occurrenceDates = new Map();

  for (const chore of chores) {
    if (chore.recurring !== true) continue;
    const seriesId = chore.seriesId || chore.id;
    const current = templates.get(seriesId);
    if (!current || (chore.assignedDate || '') < (current.assignedDate || '')) {
      templates.set(seriesId, chore);
    }

    if (!occurrenceDates.has(seriesId)) occurrenceDates.set(seriesId, new Set());
    if (chore.assignedDate) occurrenceDates.get(seriesId).add(chore.assignedDate);
  }

  let createdCount = 0;
  const optionalSeriesIds = new Set(
    chores
      .filter((chore) => isOptionalChore(chore))
      .map((chore) => chore.seriesId || chore.id)
  );
  for (const [seriesId, template] of templates) {
    const optional = isOptionalChore(template) || optionalSeriesIds.has(seriesId);
    if (template.assignedTo && !optional) {
      const assignedUser = await db.collection('users').doc(template.assignedTo).get();
      if (assignedUser.exists && assignedUser.data().isAvailable === false) continue;
    }
    const startDate = template.assignedDate || today;
    if (!recurrenceIncludesDateForKey(startDate, template.recurrence, today, template.recurrenceEndDate)) {
      continue;
    }
    if (Array.isArray(template.skippedDates) && template.skippedDates.includes(today)) {
      continue;
    }

    // Optional recurring chores are one-day opportunities. Remove an old,
    // still-unclaimed occurrence when the next scheduled occurrence arrives
    // so the optional list never accumulates yesterday's copy.
    const staleOptional = chores.filter((chore) => {
      const choreSeriesId = chore.seriesId || chore.id;
      return choreSeriesId === seriesId
        && chore.id !== `${seriesId}_${today}`
        && chore.assignedDate
        && chore.assignedDate < today
        && chore.status === 'pending'
        && isUnclaimedOptionalChore(chore);
    });
    await Promise.all(staleOptional.map((chore) => chore.ref.delete()));

    // The original first occurrence has a different document ID from generated
    // occurrences. Check the series/date pair instead of only checking the
    // generated ID, otherwise opening the app on the first day creates a duplicate.
    if (occurrenceDates.get(seriesId)?.has(today)) continue;

    const occurrenceRef = db.collection('chores').doc(`${seriesId}_${today}`);
    const existing = await occurrenceRef.get();
    if (existing.exists) continue;

    await occurrenceRef.set({
      householdId: template.householdId,
      seriesId,
      title: template.title,
      description: template.description || '',
      points: Number(template.points || 0),
      assignedDate: today,
      dueDate: null,
      assignedTo: optional ? null : (template.assignedTo || null),
      assignedToName: optional ? '' : (template.assignedToName || ''),
      assignedToRole: optional ? 'child' : (template.assignedToRole || 'child'),
      openToAnyone: optional ? true : Boolean(template.openToAnyone),
      originallyAvailable: optional,
      photoRequired: Boolean(template.photoRequired),
      requiresApproval: Boolean(template.requiresApproval),
      recurring: true,
      recurrence: template.recurrence || {frequency: 'daily'},
      status: 'pending',
      source: template.source || 'recurring',
      createdBy: template.createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    occurrenceDates.get(seriesId)?.add(today);
    createdCount += 1;
  }

  return {createdCount, checked: templates.size, date: today};
}


// ============================================================
// FIND NEXT RECURRING DATE
// ============================================================

function getNextDate(
  dueDate,
  recurrence
) {
  const current =
    dateFromKey(
      dueDate
    );

  if (
    recurrence?.frequency ===
    'daily'
  ) {
    return dateKey(
      addDays(
        current,
        1
      )
    );
 }

  const weekdays =
    Array.isArray(
      recurrence?.weekdays
    ) &&
    recurrence.weekdays.length
      ? [
          ...recurrence.weekdays,
        ].sort(
          (
            a,
            b
          ) =>
            a - b
        )
      : [
          current.getDay(),
        ];

  const currentDay =
    current.getDay();

  for (
    const weekday of
      weekdays
  ) {
    if (
      weekday >
      currentDay
    ) {
      return dateKey(
        addDays(
          current,
          weekday -
            currentDay
        )
      );
   }
 }

  return dateKey(
    addDays(
      current,
      7 -
        currentDay +
        weekdays[0]
    )
  );
}


// ============================================================
// FIND CURRENT/FUTURE OCCURRENCE
// ============================================================

function getNextCurrentOrFutureDate(
  startingDueDate,
  recurrence,
  today
) {
  let candidate =
    getNextDate(
      startingDueDate,
      recurrence
    );

  let safety =
    0;

  while (
    candidate <
      today &&
    safety <
      100
  ) {
    candidate =
      getNextDate(
        candidate,
        recurrence
      );

    safety += 1;
 }

  return candidate;
}


// ============================================================
// CREATE NEXT RECURRING OCCURRENCE
// ============================================================

async function createNextOccurrence(
  chore
) {
  if (
    !chore.recurring ||
    !chore.recurrence ||
    !chore.assignedDate
  ) {
    return false;
 }

  const optional = isOptionalChore(chore);
  if (chore.assignedTo && !optional) {
    const assignedUser = await db.collection('users').doc(chore.assignedTo).get();
    if (assignedUser.exists && assignedUser.data().isAvailable === false) return false;
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
 }).format(new Date());

  const nextDueDate =
    getNextCurrentOrFutureDate(
      chore.assignedDate,
      chore.recurrence,
      today
    );

  if (chore.recurrenceEndDate && nextDueDate > chore.recurrenceEndDate) {
    return false;
  }

  const seriesId =
    chore.seriesId ||
    chore.id;

  const occurrenceId =
    `${seriesId}_${nextDueDate}`;

  if (Array.isArray(chore.skippedDates) && chore.skippedDates.includes(nextDueDate)) {
    return false;
  }

  const occurrenceRef =
    db
      .collection(
        'chores'
      )
      .doc(
        occurrenceId
      );

  const existing =
    await occurrenceRef.get();

  if (
    existing.exists
  ) {
    return false;
 }

  await occurrenceRef.set({
    householdId:
      chore.householdId,

    seriesId,

    title:
      chore.title,

    description:
      chore.description ||
      '',

    points:
      Number(
        chore.points || 0
      ),

    assignedDate:
      nextDueDate,

    dueDate: null,

    assignedTo:
      optional ? null : chore.assignedTo,

    assignedToName:
      optional ? '' : (chore.assignedToName || ''),

    assignedToRole:
      optional ? 'child' : (chore.assignedToRole || 'child'),

    openToAnyone:
      optional ? true : Boolean(chore.openToAnyone),

    originallyAvailable:
      optional,

    photoRequired:
      Boolean(
        chore.photoRequired
      ),

    requiresApproval:
      Boolean(
        chore.requiresApproval
      ),

    recurring:
      true,

    recurrence:
      chore.recurrence,

    status:
      'pending',

    source:
      chore.source ||
      'recurring',

    createdBy:
      chore.createdBy,

    createdAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
 });

  logger.info(
    'Created recurring chore',
    {
      originalChoreId:
        chore.id,

      occurrenceId,

      assignedDate:
        nextDueDate,
   }
  );

  return true;
}


// ============================================================
// DAILY RECURRING CHORE FUNCTION
// ============================================================

exports.createDueRecurringChores =
  onSchedule(
    {
      schedule:
        '5 0 * * *',

      timeZone:
        TIME_ZONE,

      timeoutSeconds:
        300,

      memory:
        '256MiB',

      maxInstances:
        1,
   },

    async () => {
      logger.info(
        'Starting recurring chore generation.'
      );

      const snapshot = await db.collection('chores').where('recurring', '==', true).get();
      const householdIds = new Set(snapshot.docs.map((document) => document.data().householdId).filter(Boolean));
      let createdCount = 0;

      for (const householdId of householdIds) {
        try {
          const result = await ensureRecurringChoresForHousehold(householdId);
          createdCount += result.createdCount;
        } catch (error) {
          logger.error('Failed to ensure recurring chores.', {householdId, error: error.message});
        }
      }

      logger.info(
        'Recurring chore generation complete.',
        {
          householdsChecked: householdIds.size,

          occurrencesCreated:
            createdCount,
       }
      );
   }
  );


// ============================================================
// SEND EXPO PUSH NOTIFICATION
// ============================================================

async function commitFirestoreOperations(operations) {
  for (let index = 0; index < operations.length; index += 450) {
    const batch = db.batch();
    operations.slice(index, index + 450).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else batch.update(operation.ref, operation.data);
    });
    await batch.commit();
  }
}

// Completed chore occurrences are history only. Keep one non-completed
// recurrence definition when a series would otherwise disappear, then remove
// the completed occurrence documents to keep the database small.
exports.deleteCompletedChoresWeekly = onSchedule({
  schedule: '0 23 * * 0',
  timeZone: TIME_ZONE,
  timeoutSeconds: 300,
  memory: '256MiB',
  maxInstances: 1,
}, async () => {
  const recurringSnapshot = await db.collection('chores').where('recurring', '==', true).get();
  const completedSnapshot = await db.collection('chores').where('status', '==', 'completed').get();
  const recurringBySeries = new Map();
  const cleanupHouseholdIds = new Set();

  recurringSnapshot.docs.forEach((item) => {
    if (item.data().householdId) cleanupHouseholdIds.add(item.data().householdId);
  });
  completedSnapshot.docs.forEach((item) => {
    if (item.data().householdId) cleanupHouseholdIds.add(item.data().householdId);
  });

  // Sunday-night cleanup removes completed documents, so lock the current
  // week-ending day before those documents disappear.
  for (const householdId of cleanupHouseholdIds) {
    await updateStreakServer(householdId, {lockToday: true});
  }

  recurringSnapshot.docs.forEach((item) => {
    const data = item.data();
    const seriesId = data.seriesId || item.id;
    if (!recurringBySeries.has(seriesId)) recurringBySeries.set(seriesId, []);
    recurringBySeries.get(seriesId).push({ref: item.ref, id: item.id, data});
  });

  const templateIds = new Set();
  recurringBySeries.forEach((items) => {
    if (items.some((item) => item.data.status !== 'completed')) return;
    const candidate = items
      .filter((item) => item.data.status === 'completed')
      .sort((a, b) => String(b.data.assignedDate || '').localeCompare(String(a.data.assignedDate || '')))[0];
    if (candidate) templateIds.add(candidate.id);
  });

  const operations = [];
  completedSnapshot.docs.forEach((item) => {
    if (templateIds.has(item.id)) {
      operations.push({
        type: 'update',
        ref: item.ref,
        data: {
          status: 'template',
          isTemplate: true,
          completedAt: FieldValue.delete(),
          approvedAt: FieldValue.delete(),
          submittedAt: FieldValue.delete(),
          proofPhotoUrl: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
    } else {
      operations.push({type: 'delete', ref: item.ref});
    }
  });

  await commitFirestoreOperations(operations);
  logger.info('Weekly completed chore cleanup finished.', {
    completedChoresRemoved: operations.filter((operation) => operation.type === 'delete').length,
    recurrenceTemplatesKept: templateIds.size,
  });
});

async function sendExpoNotifications(
  tokens,
  title,
  body,
  data
) {
  const validTokens =
    tokens.filter(
      (token) =>
        typeof token ===
          'string' &&
        token.startsWith(
          'ExponentPushToken['
        )
    );

  if (
    !validTokens.length
  ) {
    return;
 }

  const messages =
    validTokens.map(
      (
        token
      ) => ({
        to:
          token,

        title,

        body,

        sound:
          'default',

        badge:
          1,

        data:
          data || {},
     })
    );

  try {
    const response =
      await fetch(
        'https://exp.host/--/api/v2/push/send',
        {
          method:
            'POST',

          headers: {
            Accept:
              'application/json',

            'Content-Type':
              'application/json',
         },

          body:
            JSON.stringify(
              messages
            ),
       }
      );

    const result =
      await response.json();

    logger.info(
      'Expo notification sent.',
      {
        result,
     }
    );
 } catch (
    error
  ) {
    logger.error(
      'Expo notification failed.',
      {
        error:
          error.message,
     }
    );
 }
}

function notificationEnabled(profile, key) {
  return profile?.notificationPreferences?.[key] !== false;
}

function notificationTitleForType(type) {
  return ({
    choreAssigned: 'New chore assigned',
    choreCompleted: 'Chore completed',
    choreApproval: 'Chore needs approval',
    missedChores: 'Missed chores need review',
    rewardRequest: 'Reward redeemed',
    rewardUpdates: 'Reward update',
    privilegeExpired: 'Privilege expired',
    patOnBack: 'Pat on the back',
    quickCleanup: 'New chores added',
  })[type] || 'Family update';
}

async function createNotificationRecords(recipientIds, householdId, body, data = {}) {
  const notificationKey = data.notificationKey || data.type || 'notification';
  const actorId = data.actorId || null;
  const profiles = await Promise.all(
    Array.from(new Set(recipientIds.filter(Boolean))).map(async (recipientId) => {
      const snap = await db.collection('users').doc(recipientId).get();
      return {id: recipientId, profile: snap.exists ? snap.data() : null};
    })
  );
  const batch = db.batch();
  let created = 0;
  profiles.forEach(({id: recipientId, profile}) => {
    if (!profile || recipientId === actorId || !notificationEnabled(profile, notificationKey)) return;
    const ref = data.dedupeKey
      ? db.collection('notifications').doc(`${data.dedupeKey}_${recipientId}_${data.dedupeDate || localDateKey()}`)
      : db.collection('notifications').doc();
    batch.set(ref, {
      recipientId,
      householdId,
      title: data.title || notificationTitleForType(data.type),
      body,
      ...data,
      notificationKey,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    created += 1;
  });
  if (created) await batch.commit();
}

async function profileTokens(userIds) {
  const profiles = await Promise.all(userIds.filter(Boolean).map((id) => db.collection('users').doc(id).get()));
  return profiles.map((snap) => snap.exists ? snap.data().expoPushToken : null).filter(Boolean);
}

exports.notifyNewInAppNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const notification = snapshot.data();
  if (notification.senderId && notification.senderId === notification.recipientId) return;
  const recipient = await db.collection('users').doc(notification.recipientId).get();
  if (!recipient.exists || !notificationEnabled(recipient.data(), notification.notificationKey || notification.type)) return;
  const tokens = await profileTokens([notification.recipientId]);
  await sendExpoNotifications(tokens, 'Coop', notification.body || 'You have a new notification.', {
    type: notification.type || 'notification',
    notificationId: event.params.notificationId,
  });
});

exports.notifyAssignedChore = onDocumentCreated('chores/{choreId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const chore = snapshot.data();
  // Recurring chores are announced by the 7 AM due-date reminder below so
  // they arrive at a useful time instead of immediately after midnight.
  if (!chore.assignedTo || chore.recurring === true || chore.status === 'completed' || chore.status === 'excused' || chore.source === 'homeReset' || chore.source === 'optionalClaim') return;
  const body = `A new chore was assigned to you: ${chore.title}.`;
  await createNotificationRecords([chore.assignedTo], chore.householdId, body, {type: 'choreAssigned', notificationKey: 'choreAssigned', actorId: chore.createdBy, choreId: event.params.choreId});
});

// Send one morning summary per family member for assigned recurring chores
// due today. Optional recurring chores are deliberately excluded until they
// are claimed for that specific day.
exports.notifyRecurringChoresDue = onSchedule({schedule: '0 7 * * *', timeZone: TIME_ZONE, timeoutSeconds: 300, memory: '256MiB', maxInstances: 1}, async () => {
  const today = localDateKey();
  const snapshot = await db.collection('chores').where('recurring', '==', true).get();
  const grouped = new Map();
  const profileCache = new Map();

  for (const item of snapshot.docs) {
    const chore = item.data();
    if (chore.assignedDate !== today || !chore.assignedTo || chore.status !== 'pending' || chore.source === 'homeReset' || isOptionalChore(chore)) continue;
    if (!profileCache.has(chore.assignedTo)) profileCache.set(chore.assignedTo, db.collection('users').doc(chore.assignedTo).get());
    const assignedUser = await profileCache.get(chore.assignedTo);
    if (!assignedUser.exists || assignedUser.data().isAvailable === false) continue;
    const key = `${chore.householdId}:${chore.assignedTo}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(chore.title || 'Recurring chore');
  }

  for (const [key, titles] of grouped) {
    const [householdId, recipientId] = key.split(':');
    const body = titles.length === 1
      ? `Recurring chore due today: ${titles[0]}.`
      : `You have ${titles.length} recurring chores due today: ${titles.join(', ')}.`;
    await createNotificationRecords([recipientId], householdId, body, {
      type: 'choreAssigned',
      notificationKey: 'choreAssigned',
      dedupeKey: 'recurringChoresDue',
      dedupeDate: today,
    });
  }
});

exports.notifyChoreStatus = onDocumentUpdated('chores/{choreId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after || before.status === after.status) return;
  if (!['completed', 'awaitingApproval'].includes(after.status)) return;
  const parents = await db.collection('users').where('householdId', '==', after.householdId).where('role', '==', 'parent').get();
  const parentIds = parents.docs.map((item) => item.id).filter((id) => id !== after.assignedTo);
  const body = after.status === 'awaitingApproval'
    ? `${after.assignedToName || 'A family member'} submitted "${after.title}" for approval.`
    : `${after.assignedToName || 'A family member'} completed "${after.title}".`;
  const type = after.status === 'awaitingApproval' ? 'choreApproval' : 'choreCompleted';
  await createNotificationRecords(parentIds, after.householdId, body, {type, notificationKey: type, actorId: after.assignedTo, choreId: event.params.choreId});
});

exports.notifyMissedChores = onSchedule({schedule: '10 0 * * *', timeZone: TIME_ZONE, timeoutSeconds: 300, memory: '256MiB', maxInstances: 1}, async () => {
  const today = localDateKey();
  const snapshot = await db.collection('chores').where('status', '==', 'pending').get();
  const grouped = new Map();
  for (const item of snapshot.docs) {
    const chore = item.data();
    const due = chore.dueDate || chore.assignedDate;
    if (!chore.householdId || !due || due >= today || chore.missedNotificationDate === today) continue;
    if (isUnclaimedOptionalChore(chore)) continue;
    if (!grouped.has(chore.householdId)) grouped.set(chore.householdId, []);
    grouped.get(chore.householdId).push({ref: item.ref, data: chore});
  }
  for (const [householdId, missed] of grouped) {
    const parents = await db.collection('users').where('householdId', '==', householdId).where('role', '==', 'parent').get();
    const parentIds = parents.docs.map((item) => item.id);
    const body = `${missed.length} chore${missed.length === 1 ? '' : 's'} missed their due date and need review.`;
    await createNotificationRecords(parentIds, householdId, body, {type: 'missedChores', notificationKey: 'missedChores'});
    const batch = db.batch();
    missed.forEach((item) => batch.update(item.ref, {missedNotificationDate: today, updatedAt: FieldValue.serverTimestamp()}));
    await batch.commit();
  }
});

exports.notifyUnfinishedChores = onSchedule({schedule: '0 20 * * *', timeZone: TIME_ZONE, timeoutSeconds: 300, memory: '256MiB', maxInstances: 1}, async () => {
  const today = localDateKey();
  const snapshot = await db.collection('chores').where('status', '==', 'pending').get();
  const grouped = new Map();
  for (const item of snapshot.docs) {
    const chore = item.data();
    const due = chore.dueDate || chore.assignedDate;
    if (!chore.householdId || !chore.assignedTo || due !== today || chore.source === 'homeReset' || chore.openToAnyone === true) continue;
    const key = `${chore.householdId}:${chore.assignedTo}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  for (const [key, count] of grouped) {
    const [householdId, recipientId] = key.split(':');
    await createNotificationRecords([recipientId], householdId, `You have ${count} unfinished chore${count === 1 ? '' : 's'} due today. Keep your streak going!`, {
      type: 'unfinishedChores', notificationKey: 'unfinishedChores', dedupeKey: 'unfinishedChores', dedupeDate: today,
    });
  }
});

exports.notifyExpiredPrivileges = onSchedule({schedule: '*/15 * * * *', timeZone: TIME_ZONE, timeoutSeconds: 300, memory: '256MiB', maxInstances: 1}, async () => {
  const now = Timestamp.now();
  const snapshot = await db.collection('redemptions').where('status', '==', 'approved').get();
  for (const item of snapshot.docs) {
    const redemption = item.data();
    const expires = redemption.privilegeExpiresAt;
    if (!expires || typeof expires.toMillis !== 'function' || expires.toMillis() > now.toMillis() || redemption.expirationNotifiedAt) continue;
    const body = `Your privilege "${redemption.rewardName}" has expired.`;
    await createNotificationRecords([redemption.userId], redemption.householdId, body, {type: 'privilegeExpired', notificationKey: 'privilegeExpired', redemptionId: item.id});
    await item.ref.update({expirationNotifiedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()});
  }
});

exports.notifyRewardStatus = onDocumentUpdated('redemptions/{redemptionId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after || before.status === after.status || !['approved', 'rejected'].includes(after.status)) return;
  const body = after.status === 'approved'
    ? `Your reward request for "${after.rewardName}" was approved.`
    : `Your reward request for "${after.rewardName}" was rejected.`;
  await createNotificationRecords([after.userId], after.householdId, body, {
    type: 'rewardUpdates',
    notificationKey: 'rewardUpdates',
    actorId: after.reviewedBy || null,
    redemptionId: event.params.redemptionId,
    status: after.status,
  });
});


// ============================================================
// REWARD REQUEST NOTIFICATION
//
// Fires whenever a child creates a new reward redemption.
//
// Finds every parent in that household and sends
// them a push notification.
// ============================================================

exports.notifyParentsOfRewardRequest =
  onDocumentCreated(
    'redemptions/{redemptionId}',

    async (event) => {
      const snapshot =
        event.data;

      if (!snapshot) {
        return;
     }

      const redemption =
        snapshot.data();

      if (!['pending', 'approved'].includes(redemption.status)) {
        return;
     }

      const householdId =
        redemption.householdId;

      if (!householdId) {
        logger.error(
          'Reward redemption has no householdId.',
          {
            redemptionId:
              event.params
                .redemptionId,
         }
        );

        return;
     }

      const parentsSnapshot =
        await db
          .collection(
            'users'
          )
          .where(
            'householdId',
            '==',
            householdId
          )
          .where(
            'role',
            '==',
            'parent'
          )
          .get();

      const tokens =
        parentsSnapshot.docs
          .filter((parent) => parent.id !== redemption.userId && notificationEnabled(parent.data(), 'rewardRequest'))
          .map(
            (
              parent
            ) =>
              parent.data()
                .expoPushToken
          )
          .filter(
            Boolean
          );

      if (
        !tokens.length
      ) {
        logger.info(
          'No parent push tokens found.',
          {
            householdId,
         }
        );

        return;
     }

      await sendExpoNotifications(
        tokens,

        'Coop',

        `${redemption.userName || 'A family member'} redeemed "${redemption.rewardName}".`,

        {
          type:
            'rewardRequest',

          redemptionId:
            event.params
              .redemptionId,

          householdId,
       }
      );
   }
  );
// ============================================================
// SECURE FAMILY REWARD CONTRIBUTION
// ============================================================
const {onCall, HttpsError} = require('firebase-functions/v2/https');

exports.notifyQuickCleanup = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const parent = await requireProfile(request.auth.uid);
  if (parent.role !== 'parent' || parent.householdId !== request.data?.householdId) {
    throw new HttpsError('permission-denied', 'Only a parent can send Quick Cleanup notifications.');
  }
  const recipientIds = Array.isArray(request.data?.recipientIds)
    ? Array.from(new Set(request.data.recipientIds.filter((id) => id && id !== request.auth.uid)))
    : [];
  const count = Math.max(Number(request.data?.count || 0), 1);
  if (recipientIds.length) {
    await createNotificationRecords(recipientIds, parent.householdId, `You have ${count} new Quick Cleanup chore${count === 1 ? '' : 's'} to complete.`, {
      type: 'choreAssigned', notificationKey: 'choreAssigned', actorId: request.auth.uid,
    });
  }
  return {sent: recipientIds.length};
});
const {getAuth} = require('firebase-admin/auth');

exports.contributeToFamilyReward = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to contribute points.');
  const uid = request.auth.uid;
  const rewardId = String(request.data?.rewardId || '');
  const amount = Number(request.data?.amount);
  if (!rewardId || !Number.isInteger(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Choose a valid point amount.');
 }

  const userRef = db.collection('users').doc(uid);
  const rewardRef = db.collection('rewards').doc(rewardId);
  const contributionRef = db.collection('contributions').doc();

  return db.runTransaction(async (tx) => {
    const [userSnap, rewardSnap] = await Promise.all([tx.get(userRef), tx.get(rewardRef)]);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Your Coop profile was not found.');
    if (!rewardSnap.exists) throw new HttpsError('not-found', 'Family reward not found.');
    const user = userSnap.data();
    const reward = rewardSnap.data();
    if (user.householdId !== reward.householdId) throw new HttpsError('permission-denied', 'That reward is not in your household.');
    if (!reward.isFamilyReward && reward.type !== 'family') throw new HttpsError('failed-precondition', 'This is not a family reward.');
    const points = Number(user.points || 0);
    const shared = Number(reward.sharedPoints || 0);
    const goal = Number(reward.goal || reward.cost || 0);
    if (points < amount) throw new HttpsError('failed-precondition', 'You do not have enough points.');
    if (shared >= goal) throw new HttpsError('failed-precondition', 'This family reward is already complete.');
    const actual = Math.min(amount, goal - shared);
    tx.update(userRef, {points: points - actual, updatedAt: FieldValue.serverTimestamp()});
    tx.update(rewardRef, {sharedPoints: shared + actual, updatedAt: FieldValue.serverTimestamp()});
    tx.set(contributionRef, {householdId: user.householdId, rewardId, userId: uid, amount: actual, createdAt: FieldValue.serverTimestamp()});
    return {amount: actual, userPoints: points - actual, sharedPoints: shared + actual, goal};
 });
});

// ============================================================
// DELETE CURRENT PROFILE + FIREBASE AUTH ACCOUNT
// ============================================================
exports.deleteMyProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = request.auth.uid;
  await db.collection('users').doc(uid).delete();
  await getAuth().deleteUser(uid);
  return {deleted: true};
});

// Parent-only removal of a child from the household. Removing the Auth user as
// well prevents the child's device from being left signed into an orphaned
// profile that can no longer use the app. Historical household records remain.
exports.removeChildFromFamily = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const parent = await requireProfile(request.auth.uid);
  if (parent.role !== 'parent' || !parent.householdId) {
    throw new HttpsError('permission-denied', 'Only a parent can remove a child.');
  }

  const childId = String(request.data?.childId || '');
  if (!childId) throw new HttpsError('invalid-argument', 'Child is required.');
  if (childId === request.auth.uid) throw new HttpsError('failed-precondition', 'You cannot remove yourself here.');

  const childRef = db.collection('users').doc(childId);
  const childSnap = await childRef.get();
  if (!childSnap.exists) throw new HttpsError('not-found', 'Child profile not found.');
  const child = childSnap.data();
  if (child.role !== 'child' || child.householdId !== parent.householdId) {
    throw new HttpsError('permission-denied', 'That user is not a child in your family.');
  }

  await childRef.delete();
  try { await getAuth().deleteUser(childId); } catch (error) {
    logger.warn('Child profile removed but Auth cleanup failed', {childId, error: error?.message});
  }
  return {removed: true};
});

// ============================================================
// SECURE APP MUTATIONS (rewards, chores, streaks)
// ============================================================
function localDateKey() {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const obj=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}
async function requireProfile(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Your Coop profile was not found.');
  return {id: snap.id, ...snap.data()};
}

exports.ensureRecurringChores = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const profile = await requireProfile(request.auth.uid);
  if (!profile.householdId) throw new HttpsError('failed-precondition', 'Your Coop profile is not in a household.');

  return ensureRecurringChoresForHousehold(profile.householdId);
});

exports.refreshStreak = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const profile = await requireProfile(request.auth.uid);
  if (!profile.householdId || profile.householdId !== request.data?.householdId) {
    throw new HttpsError('permission-denied', 'That household is not available.');
  }
  return {streak: await updateStreakServer(profile.householdId)};
});

exports.redeemReward = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated','Sign in to redeem rewards.');
  const uid=request.auth.uid, rewardId=String(request.data?.rewardId||'');
  if(!rewardId) throw new HttpsError('invalid-argument','Reward is required.');
  const userRef=db.collection('users').doc(uid), rewardRef=db.collection('rewards').doc(rewardId), redemptionRef=db.collection('redemptions').doc();
  return db.runTransaction(async tx=>{
    const [us,rs]=await Promise.all([tx.get(userRef),tx.get(rewardRef)]);
    if(!us.exists||!rs.exists) throw new HttpsError('not-found','User or reward not found.');
    const user=us.data(), reward=rs.data();
    if(user.householdId!==reward.householdId) throw new HttpsError('permission-denied','That reward is not in your household.');
    if(reward.isFamilyReward||reward.type==='family') throw new HttpsError('failed-precondition','Contribute to family rewards instead.');
    const cost=Number(reward.cost||reward.points||0), points=Number(user.points||0), today=localDateKey(), availability=reward.availability||'all';
    const assignedIds = Array.isArray(reward.assignedToIds) && reward.assignedToIds.length
      ? reward.assignedToIds
      : (reward.assignedTo ? [reward.assignedTo] : []);
    if (availability === 'specific' && assignedIds.length && !assignedIds.includes(uid)) {
      throw new HttpsError('permission-denied', 'This reward is assigned to another family member.');
    }
    if (reward.recurring && reward.recurrence?.frequency === 'weekly') {
      const weekdays = Array.isArray(reward.recurrence.weekdays) ? reward.recurrence.weekdays : [];
      const weekday = new Date(`${today}T12:00:00`).getDay();
      if (weekdays.length && !weekdays.includes(weekday)) throw new HttpsError('failed-precondition', 'This reward is not available today.');
    }
    const durationHours=Number(reward.privilegeDurationHours||0), redeemedAt=Timestamp.now(), privilegeExpiresAt=durationHours>0?Timestamp.fromMillis(redeemedAt.toMillis()+durationHours*60*60*1000):null;
    if(points<cost) throw new HttpsError('failed-precondition',`You need ${cost-points} more points.`);
    let claimRef=null;
    if(availability==='first') claimRef=db.collection('rewardClaims').doc(`first_${rewardId}`);
    else if(reward.dailyPrivilege||reward.limitPerDay) claimRef=db.collection('rewardClaims').doc(`${rewardId}_${uid}_${today}`);
    else claimRef=db.collection('rewardClaims').doc(`${rewardId}_${uid}`);
    if(claimRef && (await tx.get(claimRef)).exists) throw new HttpsError('already-exists',availability==='first'?'Someone already claimed this reward.':'You already redeemed this reward today.');
    tx.update(userRef,{points:points-cost,updatedAt:FieldValue.serverTimestamp()});
    tx.set(redemptionRef,{householdId:user.householdId,rewardId,rewardName:reward.name,cost,userId:uid,userName:user.name||'Family member',status:'approved',reviewedAt:FieldValue.serverTimestamp(),availability,assignedTo:reward.assignedTo||null,dailyPrivilege:Boolean(reward.dailyPrivilege||reward.limitPerDay),limitPerDay:Boolean(reward.dailyPrivilege||reward.limitPerDay),recurring:Boolean(reward.recurring),recurrence:reward.recurrence||null,redeemedDate:today,privilegeDurationHours:durationHours||null,redeemedAt,privilegeExpiresAt,claimId:claimRef?claimRef.id:null,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    if(claimRef) tx.set(claimRef,{householdId:user.householdId,rewardId,userId:uid,redemptionId:redemptionRef.id,claimType:availability==='first'?'first':(reward.dailyPrivilege||reward.limitPerDay)?'daily':'once',redeemedDate:today,createdAt:FieldValue.serverTimestamp()});
    return {redemptionId:redemptionRef.id};
 });
});
exports.reviewRedemption = onCall(async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Sign in first.');
  const parent=await requireProfile(request.auth.uid); if(parent.role!=='parent') throw new HttpsError('permission-denied','Only parents can review rewards.');
  const id=String(request.data?.redemptionId||''), decision=request.data?.decision;
  if(!id||!['approved','rejected'].includes(decision)) throw new HttpsError('invalid-argument','Invalid review.');
  const ref=db.collection('redemptions').doc(id);
  return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Request not found.');const r=snap.data();if(r.householdId!==parent.householdId)throw new HttpsError('permission-denied','Wrong household.');if(r.status!=='pending')throw new HttpsError('failed-precondition','This request was already reviewed.');
    if(decision==='rejected'){const userRef=db.collection('users').doc(r.userId);const us=await tx.get(userRef);if(us.exists)tx.update(userRef,{points:Number(us.data().points||0)+Number(r.cost||0),updatedAt:FieldValue.serverTimestamp()});if(r.claimId)tx.delete(db.collection('rewardClaims').doc(r.claimId));}
    tx.update(ref,{status:decision,reviewedAt:FieldValue.serverTimestamp(),reviewedBy:request.auth.uid,updatedAt:FieldValue.serverTimestamp()});return {status:decision};});
});
async function updateStreakServer(householdId, options = {}) {
  const today=localDateKey();
  const qs=await db.collection('chores').where('householdId','==',householdId).get();
  const counted=qs.docs.map(d=>d.data()).filter(c=>!c.isTemplate && c.assignedTo && !isOptionalChore(c) && c.source!=='homeReset' && c.status!=='excused');
  const dateForStreak=c=>c.recurring?c.assignedDate:(c.dueDate||c.assignedDate);
  const days=[...new Set(counted.map(dateForStreak).filter(date=>date&&date<=today))].sort().reverse();
  const choresByDate = new Map();
  const choresByUser = new Map();
  counted.forEach((chore) => {
    const date = dateForStreak(chore);
    if (!date) return;
    if (!choresByDate.has(date)) choresByDate.set(date, []);
    choresByDate.get(date).push(chore);
    if (!choresByUser.has(chore.assignedTo)) choresByUser.set(chore.assignedTo, []);
    choresByUser.get(chore.assignedTo).push(chore);
  });
  const href=db.collection('households').doc(householdId);
  let streak = 0;
  await db.runTransaction(async tx=>{
    const hs=await tx.get(href); if(!hs.exists)return;
    const household = hs.data();
    const lockedDays = {...(household.streakDayStatus || {})};
    const lockedDaysByUser = {...(household.streakDayStatusByUser || {})};

    // Historical days are locked the first time they are evaluated after
    // midnight. Deleting a missed chore later cannot rewrite the result.
    days.filter((date) => options.lockToday ? date <= today : date < today).forEach((date) => {
      if (!Object.prototype.hasOwnProperty.call(lockedDays, date)) {
        const dayChores = choresByDate.get(date) || [];
        lockedDays[date] = dayChores.length > 0 && dayChores.every((chore) => chore.status === 'completed');
      }
    });

    choresByUser.forEach((userChores, userId) => {
      const userLockedDays = {...(lockedDaysByUser[userId] || {})};
      const userDates = new Set(userChores.map(dateForStreak).filter(Boolean));
      userDates.forEach((date) => {
        if (options.lockToday ? date > today : date >= today) return;
        if (Object.prototype.hasOwnProperty.call(userLockedDays, date)) return;
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

    for (const date of evaluationDates) {
      const dayChores = choresByDate.get(date) || [];
      const complete = date < today
        ? lockedDays[date] === true
        : dayChores.length > 0 && dayChores.every((chore) => chore.status === 'completed');
      if (!complete) break;
      streak += 1;
    }

    tx.update(href,{streak,streakDayStatus:lockedDays,streakDayStatusByUser:lockedDaysByUser,lastStreakDate:today,updatedAt:FieldValue.serverTimestamp()});
  });
  return streak;
}
exports.completeChore = onCall(async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.'); const uid=request.auth.uid,id=String(request.data?.choreId||''); if(!id)throw new HttpsError('invalid-argument','Chore required.');
 const ref=db.collection('chores').doc(id); let householdId=null;
 const result=await db.runTransaction(async tx=>{const cs=await tx.get(ref);if(!cs.exists)throw new HttpsError('not-found','Chore not found.');const c=cs.data();householdId=c.householdId;if(c.assignedTo!==uid)throw new HttpsError('permission-denied','This chore is not assigned to you.');if(c.status!=='pending')throw new HttpsError('failed-precondition','This chore has already been completed or submitted.');
 if(c.recurring && c.assignedDate !== localDateKey()) throw new HttpsError('failed-precondition','Recurring chores can only be completed on their scheduled day.');
 const needs=Boolean(c.requiresApproval); if(needs){tx.update(ref,{status:'awaitingApproval',proofPhotoUrl:request.data?.photoUrl||null,submittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {status:'awaitingApproval'};}
 const ur=db.collection('users').doc(uid),us=await tx.get(ur);if(!us.exists)throw new HttpsError('not-found','User not found.');tx.update(ur,{points:Number(us.data().points||0)+Number(c.points||0),updatedAt:FieldValue.serverTimestamp()});tx.update(ref,{status:'completed',proofPhotoUrl:request.data?.photoUrl||null,submittedAt:FieldValue.serverTimestamp(),completedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {status:'completed'};});
 if(result.status==='completed'&&householdId)await updateStreakServer(householdId); return result;
});
exports.reviewChore = onCall(async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');const parent=await requireProfile(request.auth.uid);if(parent.role!=='parent')throw new HttpsError('permission-denied','Only parents can review chores.');const id=String(request.data?.choreId||''),decision=request.data?.decision;const ref=db.collection('chores').doc(id);let householdId=null;
 const result=await db.runTransaction(async tx=>{const cs=await tx.get(ref);if(!cs.exists)throw new HttpsError('not-found','Chore not found.');const c=cs.data();householdId=c.householdId;if(c.householdId!==parent.householdId)throw new HttpsError('permission-denied','Wrong household.');if(c.status!=='awaitingApproval')throw new HttpsError('failed-precondition','This chore is not waiting for approval.');if(decision==='rejected'){tx.update(ref,{status:'pending',rejectionNote:request.data?.note||'',proofPhotoUrl:null,submittedAt:null,approvedAt:null,completedAt:null,updatedAt:FieldValue.serverTimestamp()});return {status:'pending'};}if(decision!=='approved')throw new HttpsError('invalid-argument','Invalid review.');const ur=db.collection('users').doc(c.assignedTo),us=await tx.get(ur);if(!us.exists)throw new HttpsError('not-found','Assigned user not found.');tx.update(ur,{points:Number(us.data().points||0)+Number(c.points||0),updatedAt:FieldValue.serverTimestamp()});tx.update(ref,{status:'completed',approvedAt:FieldValue.serverTimestamp(),completedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {status:'completed'};});
 if(result.status==='completed'&&householdId)await updateStreakServer(householdId); return result;
});
