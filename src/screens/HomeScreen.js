import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { format } from 'date-fns';

import Screen from '../components/Screen';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import ProgressBar from '../components/ProgressBar';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import WeeklyCalendar from '../components/WeeklyCalendar';
import AdaptiveName from '../components/AdaptiveName';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  getHouseholdChores,
  isMissedChore,
  refreshFamilyStreak,
} from '../services/choreService';

import {
  getFamilyMembers,
  getHousehold,
  savePushToken,
  updateUserProfile,
} from '../services/familyService';

import {
  getHouseholdRedemptions,
  getUserRedemptions,
} from '../services/rewardService';

import {
  registerForPushNotificationsAsync,
} from '../services/notificationService';

import {
  db,
} from '../firebase/config';

import {
  colors,
} from '../theme/colors';

import {
  dateValue,
  formatAmericanDateTime,
} from '../utils/dateFormatters';

function notificationTitleForType(type) {
  return {
    choreAssigned: 'New chore assigned',
    choreCompleted: 'Chore completed',
    choreApproval: 'Chore needs approval',
    missedChores: 'Missed chores need review',
    rewardRequest: 'Reward redeemed',
    rewardUpdates: 'Reward update',
    privilegeExpired: 'Privilege expired',
    patOnBack: 'Pat on the back',
    quickCleanup: 'New chores added',
  }[type] || 'Family update';
}

function choreDueOnDate(chore, key) {
  if (chore?.recurring) return chore.assignedDate === key;
  return chore?.dueDate ? chore.dueDate === key : chore?.assignedDate === key;
}

function WelcomeFeature({ title, body }) {
  return <View style={styles.welcomeFeature}><View style={styles.welcomeFeatureDot}><Ionicons name="checkmark" size={14} color={colors.white} /></View><View style={styles.welcomeFeatureCopy}><Text style={styles.welcomeFeatureTitle}>{title}</Text><Text style={styles.welcomeFeatureBody}>{body}</Text></View></View>;
}

export default function HomeScreen({
  navigation,
}) {
  const {
    profile,
    refreshProfile,
  } = useAuth();

  const {
    width,
  } = useWindowDimensions();

  const isTablet =
    width >= 768;

  const [chores, setChores] =
    useState([]);

  const [members, setMembers] =
    useState([]);

  const [household, setHousehold] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notificationRedemptions, setNotificationRedemptions] =
    useState([]);

  const [appNotifications, setAppNotifications] = useState([]);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [tipsOpen, setTipsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);

  useEffect(() => {
    if (profile?.id && profile.hasSeenWelcome !== true) {
      setWelcomeOpen(true);
      setWelcomeStep(0);
    }
  }, [profile?.id, profile?.hasSeenWelcome]);

  const finishWelcome = async () => {
    if (!profile?.id || welcomeSaving) return;
    setWelcomeSaving(true);
    try {
      await updateUserProfile(profile.id, {hasSeenWelcome: true});
      await refreshProfile();
      setWelcomeOpen(false);
    } catch (err) {
      setError(err.message || 'Could not finish welcome setup.');
    } finally {
      setWelcomeSaving(false);
    }
  };

  const [
    pendingApprovalCount,
    setPendingApprovalCount,
  ] = useState(0);


  useEffect(() => {
    let active = true;
    if (!profile?.id) return undefined;
    AsyncStorage.getItem(`coop:dismissed-notifications:${profile.id}`)
      .then((value) => {
        if (!active) return;
        try { setDismissedNotificationIds(value ? JSON.parse(value) : []); }
        catch { setDismissedNotificationIds([]); }
      })
      .catch(() => { if (active) setDismissedNotificationIds([]); });
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return undefined;
    AsyncStorage.getItem(`coop:read-notifications:${profile.id}`)
      .then((value) => {
        if (!active) return;
        try { setReadNotificationIds(value ? JSON.parse(value) : []); }
        catch { setReadNotificationIds([]); }
      })
      .catch(() => { if (active) setReadNotificationIds([]); });
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(notificationsQuery, (snapshot) => {
      setAppNotifications(snapshot.docs.map((item) => ({id: item.id, ...item.data()})));
    }, () => setAppNotifications([]));
  }, [profile?.id]);

  const clearNotifications = useCallback(async (ids) => {
    const next = Array.from(new Set([...dismissedNotificationIds, ...ids]));
    setDismissedNotificationIds(next);
    if (profile?.id) {
      try { await AsyncStorage.setItem(`coop:dismissed-notifications:${profile.id}`, JSON.stringify(next)); }
      catch { /* Clearing still works for this session if local storage is unavailable. */ }
    }
  }, [dismissedNotificationIds, profile?.id]);

  const markNotificationsRead = useCallback(async (ids) => {
    const next = Array.from(new Set([...readNotificationIds, ...ids]));
    setReadNotificationIds(next);
    if (profile?.id) {
      try { await AsyncStorage.setItem(`coop:read-notifications:${profile.id}`, JSON.stringify(next)); }
      catch { /* The badge is still cleared for this session. */ }
    }
  }, [profile?.id, readNotificationIds]);

  // ==========================================================
  // LOAD DASHBOARD DATA
  // ==========================================================

  const load = useCallback(
    async (
      refresh = false
    ) => {
      if (
        !profile?.householdId
      ) {
        return;
      }

      if (refresh) {
        setRefreshing(
          true
        );
      } else {
        setLoading(
          true
        );
      }

      setError('');

      try {
        await refreshFamilyStreak(profile.householdId);
        const [
          nextChores,
          nextMembers,
          nextHousehold,
          nextRedemptions,
        ] = await Promise.all([
          getHouseholdChores(
            profile.householdId
          ),

          getFamilyMembers(
            profile.householdId
          ),

          getHousehold(
            profile.householdId
          ),

          profile.role === 'parent'
            ? getHouseholdRedemptions(profile.householdId)
            : getUserRedemptions(profile.householdId, profile.id),
        ]);

        setChores(
          nextChores
        );

        setMembers(
          nextMembers
        );

        setHousehold(
          nextHousehold
        );

        setNotificationRedemptions(
          nextRedemptions
        );

        await refreshProfile();
      } catch (err) {
        setError(
          err.message ||
            'Could not load the dashboard.'
        );
      } finally {
        setLoading(
          false
        );

        setRefreshing(
          false
        );
      }
    },
    [
      profile?.householdId,
      refreshProfile,
    ]
  );


  // ==========================================================
  // LOAD WHEN SCREEN OPENS
  // ==========================================================

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );


  // ==========================================================
  // REGISTER PUSH TOKEN
  //
  // Every signed-in user gets a token stored on their
  // profile. The Cloud Function will use the parent tokens
  // when sending approval notifications.
  // ==========================================================

  useEffect(() => {
    if (
      !profile?.id
    ) {
      return;
    }

    let cancelled =
      false;

    const register =
      async () => {
        try {
          const token =
            await registerForPushNotificationsAsync();

          if (
            token &&
            !cancelled
          ) {
            await savePushToken(
              profile.id,
              token
            );
          }
        } catch (err) {
          console.log(
            'PUSH TOKEN REGISTRATION ERROR:',
            err
          );
        }
      };

    register();

    return () => {
      cancelled =
        true;
    };
  }, [
    profile?.id,
  ]);


  // ==========================================================
  // REAL-TIME PARENT APPROVAL COUNT
  //
  // This watches chores awaiting approval so the parent immediately
  // sees when a submission needs attention.
  // ==========================================================

  useEffect(() => {
    if (
      profile?.role !==
        'parent' ||
      !profile?.householdId
    ) {
      setPendingApprovalCount(
        0
      );

      return undefined;
    }

    const choresQuery =
      query(
        collection(
          db,
          'chores'
        ),
        where(
          'householdId',
          '==',
          profile.householdId
        ),
        where(
          'status',
          '==',
          'awaitingApproval'
        )
      );

    let pendingChores =
      0;

    const unsubscribeChores =
      onSnapshot(
        choresQuery,
        (snapshot) => {
          pendingChores = snapshot.size;

          setPendingApprovalCount(pendingChores);
        },
        (snapshotError) => {
          console.log(
            'APPROVAL CHORE LISTENER ERROR:',
            snapshotError
          );
        }
      );

    return () => {
      unsubscribeChores();
    };
  }, [
    profile?.role,
    profile?.householdId,
  ]);


  // ==========================================================
  // TODAY'S CHORES
  // ==========================================================

  const today = format(new Date(), 'yyyy-MM-dd');

  const todaysChores =
    useMemo(
      () =>
        chores.filter(
          (item) => {
            const dueToday = choreDueOnDate(item, today);
            return dueToday && item.status !== 'excused'
              && !(item.openToAnyone === true && !item.assignedTo);
          }
        ),
      [
        chores,
        today,
      ]
    );

  const completed =
    todaysChores.filter(
      (item) =>
        item.status ===
        'completed'
    ).length;

  const waiting =
    todaysChores.filter(
      (item) =>
        item.status ===
        'awaitingApproval'
    ).length;

  const progress =
    todaysChores.length
      ? completed /
        todaysChores.length
      : 0;


  // ==========================================================
  // MISSED CHORES
  // ==========================================================

  const missed = chores.filter(isMissedChore);

  const notificationItems = useMemo(() => {
    const items = [];
    const notificationEnabled = (key) => profile?.notificationPreferences?.[key] !== false;

    chores
      .filter((item) => item.assignedTo === profile?.id &&
        choreDueOnDate(item, today) &&
        item.status === 'pending' &&
        notificationEnabled('choreAssigned'))
      .forEach((item) => {
        items.push({
          id: `todo-${item.id}`,
          type: 'chore',
          icon: 'checkbox-outline',
          color: colors.blueDark,
          title: 'Chore to do today',
          body: `${item.title} · +${item.points || 0} points`,
          choreId: item.id,
        });
      });

    if (profile?.role === 'parent') {
      if (missed.length && notificationEnabled('missedChores')) {
        items.push({
          id: 'missed-chores',
          type: 'missed',
          icon: 'alert-circle-outline',
          color: colors.danger,
          title: 'Missed chores need review',
          body: `${missed.length} chore${missed.length === 1 ? '' : 's'} passed the due date.`,
          timestamp: null,
        });
      }
      chores
        .filter((item) => item.status === 'awaitingApproval' && notificationEnabled('choreApproval'))
        .forEach((item) => {
          items.push({
            id: `chore-${item.id}`,
            type: 'approval',
            icon: 'checkmark-done-outline',
            color: colors.rust,
            title: 'Chore needs approval',
            body: `${item.assignedToName || 'A family member'} · ${item.title}`,
            timestamp: item.submittedAt || item.updatedAt,
            choreId: item.id,
          });
      });

    } else {
      chores
        .filter((item) => item.assignedTo === profile?.id &&
          (item.status === 'completed' || item.status === 'awaitingApproval') &&
          notificationEnabled('choreCompleted'))
        .forEach((item) => {
          const approved = item.status === 'completed' && item.approvedAt;
          items.push({
            id: `status-${item.id}`,
            type: 'status',
            icon: approved ? 'checkmark-circle-outline' : 'time-outline',
            color: approved ? colors.success : colors.warning,
            title: approved ? 'Chore approved' : 'Chore submitted',
            body: item.title,
            timestamp: item.approvedAt || item.completedAt || item.submittedAt || item.updatedAt,
            choreId: item.id,
          });
        });

      notificationRedemptions
        .filter((item) => item.status === 'approved' && notificationEnabled('rewardUpdates'))
        .forEach((item) => {
          items.push({
            id: `redemption-${item.id}`,
            type: 'status',
            icon: 'gift-outline',
            color: colors.success,
            title: 'Reward earned',
            body: `${item.rewardName} · ${item.cost} points`,
            timestamp: item.reviewedAt || item.createdAt || item.updatedAt,
          });
      });
    }

    appNotifications
      .filter((item) => notificationEnabled(item.notificationKey || item.type))
      .forEach((item) => {
      items.push({
        id: `app-${item.id}`,
        type: item.type || 'notification',
        icon: item.type === 'patOnBack' ? 'heart-outline' : 'notifications-outline',
        color: item.type === 'privilegeExpired' ? colors.orange : colors.blueDark,
        title: item.title || notificationTitleForType(item.type),
        body: item.body || '',
        timestamp: item.createdAt,
        notificationId: item.id,
      });
      });

    return items
      .sort((a, b) => {
        if (!a.timestamp && b.timestamp) return -1;
        if (a.timestamp && !b.timestamp) return 1;
        return (dateValue(b.timestamp)?.getTime() || 0) - (dateValue(a.timestamp)?.getTime() || 0);
      })
      .slice(0, 8);
  }, [appNotifications, chores, missed, notificationRedemptions, profile?.id, profile?.role, profile?.notificationPreferences, today]);


  const visibleNotificationItems = notificationItems.filter(
    (item) => !dismissedNotificationIds.includes(item.id)
  );
  const unreadNotificationCount = visibleNotificationItems.filter(
    (item) => !readNotificationIds.includes(item.id)
  ).length;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <Screen>
        <LoadingView
          label="Loading your Coop..."
        />
      </Screen>
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            load(true)
          }
          tintColor={
            colors.rust
          }
        />
      }
    >
      <PageHeader
        eyebrow={
          household?.name ||
          'Coop'
        }
        title={`Hi, ${
          profile?.name ||
          'there'
        }`}
        subtitle={
          profile?.role ===
          'parent'
            ? 'Here is what is happening around the house today.'
            : 'Here is what you have on your plate today.'
        }
        right={
          <View style={styles.headerTools}>
            {profile?.role === 'parent' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tips for parents"
                onPress={() => { setNotificationsOpen(false); setTipsOpen(true); }}
                style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
              >
                <Ionicons name="bulb-outline" size={23} color={colors.orange} />
              </Pressable>
            )}
            <NotificationButton
              count={unreadNotificationCount}
              open={notificationsOpen}
              items={visibleNotificationItems}
              onPress={() => {
                setNotificationsOpen((value) => {
                  const next = !value;
                  if (next) markNotificationsRead(visibleNotificationItems.map((item) => item.id));
                  return next;
                });
              }}
              onClearAll={() => clearNotifications(visibleNotificationItems.map((item) => item.id))}
              onItemPress={(item) => {
                setNotificationsOpen(false);
                if (item.choreId) {
                  navigation.navigate('ChoreDetail', { choreId: item.choreId });
                } else if (profile?.role === 'parent') {
                  navigation.navigate(item.type === 'missed' ? 'MissedChores' : 'Approvals');
                } else {
                  navigation.getParent()?.navigate('RewardsTab');
                }
              }}
            />
          </View>
        }
      />

      <Modal visible={tipsOpen} transparent animationType="fade" onRequestClose={() => setTipsOpen(false)}>
        <View style={styles.tipsBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTipsOpen(false)} />
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <View style={styles.tipsIcon}><Ionicons name="bulb" size={22} color={colors.orange} /></View>
              <View style={{flex: 1}}>
                <Text style={styles.tipsTitle}>Coop Parent Tips</Text>
                <Text style={styles.tipsSubtitle}>Simple ways to make this app more effective for your family</Text>
              </View>
              <Pressable accessibilityLabel="Close tips" hitSlop={10} onPress={() => setTipsOpen(false)} style={styles.tipsClose}>
                <Ionicons name="close" size={21} color={colors.gray700} />
              </Pressable>
            </View>
            {[
              ['Follow through on rewards', 'When a child earns a reward, honor it consistently. Keeping your end of the deal encourages more consistant chore completion. Small rewards can be just as motivating as big ones!'],
              ['Keep rewards worth working for', 'Mix small, easy-to-earn privileges with a few bigger goals so there is always something exciting to save toward.'],
              ['Be consistent', 'A chores app may be an adjustment for some families. Consistency is key to making the system work for everyone over time.'],
              ['Make expectations clear', 'Give chores simple names and instructions so kids know exactly what “done” looks like before they start.'],
              ['Use points consistently', 'Try to keep similar chores worth similar amounts. Predictable point values make the system feel fair.'],
              ['Celebrate the effort', 'A quick thank-you or bit of praise when a chore is completed can be just as motivating as points.'],
            ].map(([title, body]) => (
              <View key={title} style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={19} color={colors.success} />
                <View style={{flex: 1}}><Text style={styles.tipTitle}>{title}</Text><Text style={styles.tipBody}>{body}</Text></View>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={welcomeOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.welcomeBackdrop}>
          <View style={styles.welcomeCard}>
            {welcomeStep === 0 && <>
              <Text style={styles.welcomeEyebrow}>The Family Chores App</Text>
              <Text style={styles.welcomeTitle}>Welcome to Coop!</Text>
              <Text style={styles.welcomeBody}>Coop brings chores, points, rewards, and family goals into one place. Tested by both parents and children, this app helps families work together more effectively.</Text>
              <View style={styles.welcomeList}>
                <WelcomeFeature title="Stay organized" body="See what needs to be done and when it is due." />
                <WelcomeFeature title="Earn points" body="Turn everyday responsibilities into fun rewards." />
                <WelcomeFeature title="Reach goals together" body="Celebrate individual wins and family cooperation." />
              </View>
            </>}
            {welcomeStep === 1 && <>
             <Text style={styles.welcomeEyebrow}>WHY COOP?</Text>
<Text style={styles.welcomeTitle}>Your new family hub</Text>
<Text style={styles.welcomeBody}>
  Like a chicken coop, every home needs regular care to stay clean and comfortable. 
  When the whole family pitches in, everyday chores become shared responsibilities—and 
  a little more “coop”eration makes everything run more smoothly.
</Text>
            </>}
            {welcomeStep === 2 && <>
              <Text style={styles.welcomeEyebrow}>A NOTE FROM THE CREATOR</Text>
              <Text style={styles.welcomeTitle}>Thanks for trying Coop.</Text>
              <Text style={styles.welcomeBody}>I built this app based on what would have motivated me as a child. Now, I hope to help mine, and other families around the house. If Coop helps your family, please consider leaving a positive review and sharing it with a friend.</Text>
              <Text style={styles.welcomeBody}>I hope it gives your family less nagging, clearer communication, motivation, and more reasons to celebrate one another.</Text>
            </>}
            <View style={styles.welcomeDots}>{[0, 1, 2].map((step) => <View key={step} style={[styles.welcomeDot, step === welcomeStep && styles.welcomeDotActive]} />)}</View>
            <Pressable disabled={welcomeSaving} onPress={() => welcomeStep < 2 ? setWelcomeStep((step) => step + 1) : finishWelcome()} style={({ pressed }) => [styles.welcomeButton, pressed && styles.pressed, welcomeSaving && styles.disabledButton]}>
              <Text style={styles.welcomeButtonText}>{welcomeStep < 2 ? 'Next' : 'Get started'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!!error && (
        <Text
          style={styles.error}
        >
          {error}
        </Text>
      )}


      {/* =====================================================
          TODAY'S PROGRESS
          ===================================================== */}

      <Card
        style={
          styles.progressCard
        }
      >
        <View
          style={
            styles.progressTop
          }
        >
          <View>
            <Text
              style={
                styles.progressLabel
              }
            >
              Today
            </Text>

            <Text
              style={
                styles.progressTitle
              }
            >
              {completed} of{' '}
              {
                todaysChores.length
              }{' '}
              chores complete
            </Text>
          </View>

          <View
            style={
              styles.percentBadge
            }
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
              style={styles.percent}
            >
              {Math.round(
                progress *
                  100
              )}
              %
            </Text>
          </View>
        </View>

        <ProgressBar
          value={progress}
        />

        {waiting > 0 && (
          <Text
            style={
              styles.helper
            }
          >
            {waiting} waiting for parent approval
          </Text>
        )}
      </Card>


      {/* =====================================================
          APPROVAL ALERT
          ===================================================== */}

      {profile?.role ===
        'parent' &&
        pendingApprovalCount >
          0 && (
          <Pressable
            onPress={() =>
              navigation.navigate(
                'Approvals'
              )
            }
          >
            <Card
              style={
                styles.approvalCard
              }
            >
              <View
                style={
                  styles.approvalIcon
                }
              >
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={
                    colors.danger
                  }
                />

                <View
                  style={
                    styles.approvalBadge
                  }
                >
                  <Text
                    style={
                      styles.approvalBadgeText
                    }
                  >
                    {pendingApprovalCount >
                    9
                      ? '9+'
                      : pendingApprovalCount}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.approvalCopy
                }
              >
                <Text
                  style={
                    styles.approvalTitle
                  }
                >
                  You have items waiting
                </Text>

                <Text
                  style={
                    styles.approvalText
                  }
                >
                  {pendingApprovalCount}{' '}
                  approval
                  {pendingApprovalCount ===
                  1
                    ? ''
                    : 's'}{' '}
                  need your attention.
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={
                  colors.gray500
                }
              />
            </Card>
          </Pressable>
        )}


      {/* =====================================================
          FAMILY WEEK
          ===================================================== */}

      <Card>
      <WeeklyCalendar
          chores={chores}
          lockedDayStatus={household?.streakDayStatus}
          title="Family week"
          subtitle="A quick look at household progress."
        />
      </Card>


      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <View
        style={[
          styles.summaryGrid,
          isTablet &&
            styles.summaryGridTablet,
        ]}
      >
        <SummaryCard
          icon="flame-outline"
          label="Family streak"
          value={`${
            household?.streak ||
            0
          } days`}
        />

        <SummaryCard
          icon="star-outline"
          label="Your points"
          value={`${
            profile?.points ||
            0
          }`}
        />
      </View>


      {/* =====================================================
          PARENT QUICK ACTIONS
          ===================================================== */}

      {profile?.role ===
        'parent' && (
        <View
          style={styles.section}
        >
          <SectionHeader
            title="Quick actions"
            caption="Common parent tasks"
          />

          <View
            style={[
              styles.actionGrid,
              isTablet &&
                styles.actionGridTablet,
            ]}
          >
            <ActionTile
              icon="add"
              title="Add chore"
              tablet={isTablet}
              onPress={() =>
                navigation.navigate(
                  'ChoreForm'
                )
              }
            />

            <ApprovalActionTile
              count={
                pendingApprovalCount
              }
              tablet={isTablet}
              onPress={() =>
                navigation.navigate(
                  'Approvals'
                )
              }
            />

            <ActionTile
              icon="refresh-outline"
              title="Quick Cleanup"
              tablet={isTablet}
              onPress={() =>
                navigation.navigate(
                  'HomeReset'
                )
              }
            />

            <ActionTile
              icon="alert-circle-outline"
              title="Missed chores"
              badgeCount={missed.length}
              tablet={isTablet}
              onPress={() =>
                navigation.navigate(
                  'MissedChores'
                )
              }
            />

            <ActionTile
              icon="gift-outline"
              title="Add reward"
              tablet={isTablet}
              onPress={() =>
                navigation.navigate(
                  'RewardForm'
                )
              }
            />
          </View>
        </View>
      )}


      {/* =====================================================
          FAMILY TODAY
          ===================================================== */}

      <View
        style={styles.section}
      >
        <SectionHeader
          title="Family today"
          caption="See how everyone is doing."
        />

        <Card>
          {members.map(
            (
              member,
              index
            ) => {
              const memberChores =
                todaysChores.filter(
                  (item) =>
                    item.assignedTo ===
                    member.id
                );

              const memberDone =
                memberChores.filter(
                  (item) =>
                    item.status ===
                    'completed'
                ).length;

              return (
                <Pressable
                  key={
                    member.id
                  }
                  onPress={() =>
                    navigation.navigate(
                      'MemberProfile',
                      {
                        memberId:
                          member.id,
                      }
                    )
                  }
                  style={[
                    styles.memberRow,
                    index <
                      members.length -
                        1 &&
                      styles.memberDivider,
                  ]}
                >
                  {member.profilePhotoUrl ? (
                    <Image source={{ uri: member.profilePhotoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{member.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                    </View>
                  )}

                  <View
                    style={
                      styles.memberCopy
                    }
                  >
                    <AdaptiveName
                      style={
                        styles.memberName
                      }
                    >
                      {member.name}
                    </AdaptiveName>

                    <Text
                      style={
                        styles.memberMeta
                      }
                    >
                      {member.isAvailable ===
                      false
                        ? 'Excused today'
                        : `${memberDone} of ${memberChores.length} chores complete`}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.points
                    }
                  >
                    {member.points ||
                      0}{' '}
                    pts
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      colors.gray500
                    }
                  />
                </Pressable>
              );
            }
          )}
        </Card>
      </View>
    </Screen>
  );
}


// ============================================================
// FAMILY WEEK
// ============================================================

function FamilyWeek({
  chores,
}) {
  const now =
    new Date();

  const monday =
    new Date(now);

  const day =
    monday.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  monday.setDate(
    monday.getDate() +
      difference
  );

  monday.setHours(
    12,
    0,
    0,
    0
  );

  const days =
    Array.from(
      {
        length: 7,
      },
      (_, index) => {
        const date =
          new Date(
            monday
          );

        date.setDate(
          monday.getDate() +
            index
        );

        return date;
      }
    );

  return (
    <View
      style={styles.week}
    >
      <View>
        <Text
          style={
            styles.weekTitle
          }
        >
          Family week
        </Text>

        <Text
          style={
            styles.weekSubtitle
          }
        >
          A quick look at household progress.
        </Text>
      </View>

      <View
        style={
          styles.weekRow
        }
      >
        {days.map(
          (date) => {
            const key =
              date.toISOString()
                .slice(
                  0,
                  10
                );

            const dayChores =
              chores.filter(
                (chore) =>
                  chore.assignedDate ===
                  key &&
                  chore.status !== 'excused'
              );

            const completed =
              dayChores.filter(
                (chore) =>
                  chore.status ===
                  'completed'
              ).length;

            const isToday =
              key ===
              new Date()
                .toISOString()
                .slice(
                  0,
                  10
                );

            let status =
              'empty';

            if (
              dayChores.length
            ) {
              if (
                completed ===
                dayChores.length
              ) {
                status =
                  'complete';
              } else if (
                completed >
                0
              ) {
                status =
                  'partial';
              } else if (
                date <
                new Date()
              ) {
                status =
                  'missed';
              } else {
                status =
                  'pending';
              }
            }

            return (
              <View
                key={
                  key
                }
                style={[
                  styles.weekDay,
                  isToday &&
                    styles.weekToday,
                ]}
              >
                <Text
                  style={
                    styles.weekDayName
                  }
                >
                  {date.toLocaleDateString(
                    undefined,
                    {
                      weekday:
                        'short',
                    }
                  )}
                </Text>

                <View
                  style={[
                    styles.weekCircle,
                    styles[
                      `weekCircle_${status}`
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.weekNumber,
                      status ===
                        'complete' &&
                        styles.weekNumberComplete,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>

                <View
                  style={[
                    styles.weekDot,
                    styles[
                      `weekDot_${status}`
                    ],
                  ]}
                />
              </View>
            );
          }
        )}
      </View>
    </View>
  );
}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  icon,
  label,
  value,
}) {
  return (
    <Card
      style={
        styles.summaryCard
      }
    >
      <View
        style={
          styles.summaryIcon
        }
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            colors.blueDark
          }
        />
      </View>

      <Text
        style={
          styles.summaryValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>
    </Card>
  );
}


// ============================================================
// NORMAL ACTION TILE
// ============================================================

function ActionTile({
  icon,
  title,
  badgeCount = 0,
  onPress,
  tablet = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        tablet && styles.actionTileTablet,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={
          styles.actionIcon
        }
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            colors.rust
          }
        />

        {badgeCount > 0 && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </View>

      <Text
        style={
          styles.actionText
        }
      >
        {title}
      </Text>

      <Ionicons
        name="chevron-forward"
        size={17}
        color={
          colors.gray500
        }
      />
    </Pressable>
  );
}


// ============================================================
// APPROVAL ACTION TILE
// ============================================================

function ApprovalActionTile({
  count,
  onPress,
  tablet = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        tablet && styles.actionTileTablet,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={
          styles.actionIcon
        }
      >
        <Ionicons
          name="checkmark-done-outline"
          size={20}
          color={
            colors.rust
          }
        />

        {count > 0 && (
          <View
            style={
              styles.actionBadge
            }
          >
            <Text
              style={
                styles.actionBadgeText
              }
            >
              {count > 9
                ? '9+'
                : count}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={
          styles.actionText
        }
      >
        Approvals
      </Text>

      {count > 0 && (
        <Text
          style={
            styles.actionWaiting
          }
        >
          Waiting
        </Text>
      )}

      <Ionicons
        name="chevron-forward"
        size={17}
        color={
          colors.gray500
        }
      />
    </Pressable>
  );
}

function NotificationButton({ count, open, items, onPress, onItemPress, onClearAll }) {
  return (
    <View style={styles.notificationWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={count ? `${count} notifications` : 'Notifications'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.notificationButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={open ? 'notifications' : 'notifications-outline'}
          size={22}
          color={colors.charcoal}
        />
        {count > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {count > 9 ? '9+' : count}
            </Text>
          </View>
        )}
      </Pressable>

      {open && (
        <View style={styles.notificationMenu}>
          <View style={styles.notificationMenuHeader}>
            <View style={{flex: 1}}>
              <Text style={styles.notificationMenuTitle}>Notifications</Text>
              <Text style={styles.notificationMenuSubtitle}>
                {items.length ? `${items.length} recent update${items.length === 1 ? '' : 's'}` : 'You’re all caught up'}
              </Text>
            </View>
            {!!items.length && (
              <Pressable accessibilityRole="button" onPress={onClearAll} hitSlop={8} style={styles.clearNotificationsButton}>
                <Text style={styles.clearNotificationsText}>Clear all</Text>
              </Pressable>
            )}
          </View>

          {!items.length ? (
            <View style={styles.notificationEmpty}>
              <View style={styles.notificationEmptyIcon}>
                <Ionicons name="checkmark" size={18} color={colors.success} />
              </View>
              <Text style={styles.notificationEmptyText}>Nothing new right now.</Text>
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onItemPress(item)}
                style={({ pressed }) => [
                  styles.notificationItem,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.notificationItemIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon} size={17} color={item.color} />
                </View>
                <View style={styles.notificationItemCopy}>
                  <Text style={styles.notificationItemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.notificationItemBody} numberOfLines={1}>{item.body}</Text>
                  {!!item.timestamp && (
                    <Text style={styles.notificationItemTime}>{formatAmericanDateTime(item.timestamp)}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  progressCard: {
    padding: 20,
    gap: 15,
    backgroundColor: colors.surface,
  },

  progressTop: {
    flexDirection:
      'row',
    justifyContent:
      'space-between',
    alignItems:
      'center',
    gap: 12,
  },

  progressLabel: {
    color: colors.rust,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },

  progressTitle: {
    color: colors.charcoal,
    fontSize: 19,
    fontWeight: '800',
  },

  percentBadge: {
    backgroundColor: colors.white,
    borderRadius: 14,
    width: 52,
    height: 52,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  percent: {
    color: colors.rust,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },

  helper: {
    color: colors.gray500,
    fontSize: 13,
  },

  approvalCard: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 12,
    backgroundColor: colors.dangerSoft,
  },

  approvalIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor:
      colors.white,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  approvalBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor:
      colors.danger,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  approvalBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },

  approvalCopy: {
    flex: 1,
    gap: 2,
  },

  approvalTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '800',
  },

  approvalText: {
    color: colors.gray700,
    fontSize: 13,
  },

  week: {
    gap: 16,
  },

  weekTitle: {
    color: colors.charcoal,
    fontSize: 19,
    fontWeight: '800',
  },

  weekSubtitle: {
    color: colors.gray500,
    fontSize: 13,
    marginTop: 3,
  },

  weekRow: {
    flexDirection:
      'row',
    justifyContent:
      'space-between',
  },

  weekDay: {
    minWidth: 35,
    alignItems:
      'center',
    gap: 6,
    paddingVertical:
      4,
    borderRadius: 10,
  },

  weekToday: {
    backgroundColor: colors.surfaceMuted,
  },

  weekDayName: {
    color: colors.gray500,
    fontSize: 11,
    fontWeight: '700',
  },

  weekCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems:
      'center',
    justifyContent:
      'center',
    borderWidth: 0,
  },

  weekCircle_complete: {
    backgroundColor: colors.successSoft,
  },

  weekCircle_partial: {
    backgroundColor: colors.blueSoft,
  },

  weekCircle_missed: {
    backgroundColor: colors.dangerSoft,
  },

  weekCircle_pending: {
    backgroundColor: colors.white,
  },

  weekCircle_empty: {
    backgroundColor: colors.surfaceMuted,
  },

  weekNumber: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },

  weekNumberComplete: {
    color: colors.success,
  },

  weekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  weekDot_complete: {
    backgroundColor:
      colors.success,
  },

  weekDot_partial: {
    backgroundColor:
      colors.blue,
  },

  weekDot_missed: {
    backgroundColor:
      colors.danger,
  },

  weekDot_pending: {
    backgroundColor:
      colors.gray300,
  },

  weekDot_empty: {
    backgroundColor:
      colors.gray200,
  },

  summaryGrid: {
    flexDirection:
      'row',
    gap: 10,
  },

  summaryGridTablet: {
    width: '100%',
    alignSelf: 'stretch',
  },

  summaryCard: {
    flex: 1,
    minHeight: 124,
    padding: 16,
  },

  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      colors.blueSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.charcoal,
  },

  summaryLabel: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '600',
  },

  section: {
    gap: 10,
  },

  actionGrid: {
    gap: 8,
  },

  actionGridTablet: {
    flexDirection:
      'row',
    flexWrap:
      'wrap',
  },

  actionTile: {
    minHeight: 64,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal:
      14,
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 10,
  },

  actionTileTablet: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
  },

  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor:
      colors.creamSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  actionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor:
      colors.danger,
    alignItems:
      'center',
    justifyContent:
      'center',
    borderWidth: 2,
    borderColor:
      colors.creamSoft,
  },

  actionBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },

  actionWaiting: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },

  actionText: {
    flex: 1,
    color: colors.charcoal,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.78,
  },

  missedCard: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 12,
    borderColor:
      colors.danger,
    backgroundColor:
      colors.dangerSoft,
  },

  missedIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems:
      'center',
    justifyContent:
      'center',
    backgroundColor:
      colors.white,
  },

  missedCopy: {
    flex: 1,
    gap: 3,
  },

  missedTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },

  missedText: {
    color: colors.gray700,
    fontSize: 13,
    lineHeight: 18,
  },

  memberRow: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 12,
    paddingVertical: 8,
  },

  memberDivider: {
    borderBottomWidth: 0,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor:
      colors.creamSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  avatarText: {
    color: colors.rustDark,
    fontWeight: '800',
    fontSize: 16,
  },

  memberCopy: {
    flex: 1,
    gap: 2,
  },

  memberName: {
    fontWeight:
      '800',
    color:
      colors.charcoal,
    fontSize:
      15,
  },

  memberMeta: {
    color:
      colors.gray500,
    fontSize:
      13,
  },

  points: {
    color:
      colors.blueDark,
    fontWeight:
      '700',
    fontSize:
      13,
  },

  error: {
    color:
      colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
    lineHeight:
      19,
  },

  tipsBackdrop: { flex: 1, backgroundColor: 'rgba(35,31,28,0.38)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  tipsCard: { width: '100%', maxWidth: 480, backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 17, shadowColor: colors.charcoal, shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
  tipsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipsIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  tipsTitle: { color: colors.charcoal, fontSize: 18, fontWeight: '800' },
  tipsSubtitle: { color: colors.gray500, fontSize: 12, lineHeight: 17, marginTop: 3 },
  tipsClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipTitle: { color: colors.charcoal, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  tipBody: { color: colors.gray700, fontSize: 12, lineHeight: 17 },

  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  notificationWrap: {
    position: 'relative',
    zIndex: 40,
  },

  notificationMenu: {
    position: 'absolute',
    top: 54,
    right: 0,
    width: 300,
    maxWidth: 300,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 8,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 50,
  },

  notificationMenuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  clearNotificationsButton: { paddingVertical: 6, paddingHorizontal: 4 },
  clearNotificationsText: { color: colors.rust, fontSize: 12, fontWeight: '800' },

  notificationMenuTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },

  notificationMenuSubtitle: {
    color: colors.gray500,
    fontSize: 11,
  },

  notificationEmpty: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },

  notificationEmptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationEmptyText: {
    color: colors.gray500,
    fontSize: 12,
  },

  notificationItem: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  notificationItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationItemCopy: {
    flex: 1,
    gap: 2,
  },

  notificationItemTitle: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '800',
  },

  notificationItemBody: {
    color: colors.gray700,
    fontSize: 11,
  },

  notificationItemTime: {
    color: colors.gray500,
    fontSize: 10,
  },

  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },

  notificationBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },

  welcomeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35,31,28,0.42)',
    padding: 22,
  },

  welcomeCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 24,
    shadowColor: colors.charcoal,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },

  welcomeLogo: {
    width: 130,
    height: 58,
    alignSelf: 'center',
    marginBottom: 18,
  },

  welcomeEyebrow: {
    color: colors.rust,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  welcomeTitle: {
    color: colors.charcoal,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },

  welcomeBody: {
    color: colors.gray700,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },

  welcomeList: {
    gap: 14,
    marginTop: 22,
    marginBottom: 22,
  },

  welcomeFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  welcomeFeatureDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },

  welcomeFeatureCopy: {
    flex: 1,
  },

  welcomeFeatureTitle: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '800',
  },

  welcomeFeatureBody: {
    color: colors.gray500,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  welcomeQuote: {
    backgroundColor: colors.rustSoft,
    borderRadius: 16,
    marginTop: 22,
    marginBottom: 24,
    padding: 18,
  },

  welcomeQuoteText: {
    color: colors.rustDark,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },

  welcomeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginTop: 24,
    marginBottom: 16,
  },

  welcomeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gray300,
  },

  welcomeDotActive: {
    width: 20,
    backgroundColor: colors.rust,
  },

  welcomeButton: {
    alignItems: 'center',
    backgroundColor: colors.rust,
    borderRadius: 14,
    paddingVertical: 14,
  },

  welcomeButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.6,
  },
});
