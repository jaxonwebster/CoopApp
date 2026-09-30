import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import Screen from '../components/Screen';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import PrivilegeCountdown from '../components/PrivilegeCountdown';
import WeeklyCalendar from '../components/WeeklyCalendar';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  getHouseholdChores,
} from '../services/choreService';

import {
  getHousehold,
} from '../services/familyService';

import {
  getUserRedemptions,
  isPrivilegeActive as activePrivilege,
} from '../services/rewardService';

import {
  colors,
} from '../theme/colors';

import {
  formatAmericanDate,
  formatAmericanDateTime,
} from '../utils/dateFormatters';

function displayTime(value) { return formatAmericanDateTime(value); }

function displayDate(value) {
  if (!value) return '';
  return formatAmericanDate(value) || value;
}

function displayStamp(item) {
  return displayTime(item.reviewedAt || item.createdAt) || displayDate(item.redeemedDate);
}

export default function ProfileScreen({
  navigation,
}) {
  const {
    profile,
    refreshProfile,
    signOut,
  } = useAuth();

  const [chores, setChores] =
    useState([]);

  const [redemptions, setRedemptions] =
    useState([]);

  const [household, setHousehold] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [, setPrivilegeClock] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setPrivilegeClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError('');

        try {
            const [
              allChores,
              home,
              rewards,
            ] =
              await Promise.all([
                getHouseholdChores(
                  profile.householdId
                ),

                getHousehold(
                  profile.householdId
                ),

                getUserRedemptions(
                profile.householdId,
                profile.id
              ),
            ]);

          setChores(
            allChores
          );

          setHousehold(home);

          setRedemptions(
            rewards
          );

          await refreshProfile();
        } catch (err) {
          setError(
            err.message ||
              'Could not load profile.'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        profile.householdId,
        profile.id,
        refreshProfile,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading profile..." />
      </Screen>
    );
  }

  const activePrivileges = redemptions.filter((item) => item.status === 'approved' && activePrivilege(item));
  const expiredPrivileges = redemptions.filter((item) => item.status === 'approved' && !activePrivilege(item));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('ProfileEdit')} style={({ pressed }) => [pressed && styles.pressed]} accessibilityLabel="Edit profile picture">
          {profile.profilePhotoUrl ? (
            <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{profile.name?.charAt(0)?.toUpperCase() || '?'}</Text></View>
          )}
        </Pressable>

        <View style={styles.headerCopy}>
          <PageHeader
            eyebrow="Profile"
            title={
              profile.name
            }
            subtitle={
              profile.role ===
              'parent'
                ? 'Parent account'
                : 'Kid account'
            }
          />
        </View>

        <View style={styles.settingsWrap}>
          <Pressable
            style={styles.gearButton}
            onPress={() => setMenuOpen((value) => !value)}
            hitSlop={10}
            accessibilityLabel="Profile settings"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={22} color={colors.charcoal} />
          </Pressable>
          {menuOpen && (
            <View style={styles.settingsMenu}>
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); navigation.navigate('ProfileEdit'); }}>
                <Ionicons name="person-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Edit profile</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); navigation.navigate('NotificationSettings'); }}>
                <Ionicons name="notifications-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Notification settings</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); navigation.navigate('LegalInfo', { page: 'PrivacyPolicy' }); }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Privacy policy</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); navigation.navigate('LegalInfo', { page: 'TermsOfUse' }); }}>
                <Ionicons name="document-text-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Terms of use</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); navigation.navigate('LegalInfo', { page: 'FAQs' }); }}>
                <Ionicons name="help-circle-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>FAQs</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); Linking.openURL('mailto:jaxonwebster4@gmail.com?subject=Coop%20Support'); }}>
                <Ionicons name="mail-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Contact support</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={async () => { setMenuOpen(false); await signOut(); }}>
                <Ionicons name="log-out-outline" size={18} color={colors.charcoal} />
                <Text style={styles.menuText}>Sign out</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {!!error && (
        <Text
          style={styles.error}
        >
          {error}
        </Text>
      )}

      <Card>
        <View
          style={styles.pointsRow}
        >
          <Ionicons
            name="star-outline"
            size={28}
            color={
              colors.blueDark
            }
          />

          <View>
            <Text
              style={
                styles.pointsValue
              }
            >
              {profile.points ||
                0}
            </Text>

            <Text
              style={
                styles.pointsLabel
              }
            >
              Current points
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <WeeklyCalendar
          chores={
            chores
          }
          userId={
            profile.id
          }
          lockedDayStatus={household?.streakDayStatusByUser?.[profile.id]}
          title="My week"
          subtitle="Your completed and missed chore activity."
        />
      </Card>

      <View
        style={
          styles.summaryRow
        }
      >
        <Card
          style={
            styles.summaryCard
          }
        >
          <Text
            style={
              styles.summaryValue
            }
          >
            {
              chores.filter(
                (chore) =>
                  chore.assignedTo ===
                    profile.id &&
                  chore.status ===
                    'completed'
              ).length
            }
          </Text>

          <Text
            style={
              styles.summaryLabel
            }
          >
            Completed chores
          </Text>
        </Card>

        <Card
          style={
            styles.summaryCard
          }
        >
          <Text
            style={
              styles.summaryValue
            }
          >
            {
              redemptions.filter(
                (item) =>
                  item.status ===
                  'approved'
              ).length
            }
          </Text>

          <Text
            style={
              styles.summaryLabel
            }
          >
            Rewards earned
          </Text>
        </Card>
      </View>

      <View
        style={styles.section}
      >
        <SectionHeader
            title="Active privileges"
          caption="Rewards you've earned"
        />

        <Card>
          {!activePrivileges.length ? (
            <Text
              style={
                styles.empty
              }
            >
              You haven't redeemed any rewards yet.
            </Text>
          ) : (
            activePrivileges
              .map(
                (item) => (
                  <View
                    key={
                      item.id
                    }
                    style={
                      styles.rewardRow
                    }
                  >
                    <View
                      style={
                        styles.rewardIcon
                      }
                    >
                      <Ionicons
                        name="gift-outline"
                        size={17}
                        color={
                          colors.blueDark
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.rewardCopy
                      }
                    >
                      <Text
                        style={
                          styles.rewardName
                        }
                      >
                        {
                          item.rewardName
                        }
                      </Text>

                      <Text
                        style={
                          styles.rewardMeta
                        }
                      >
                        Reward active
                        {item.redeemedDate
                          ? ` · ${displayStamp(item)}`
                          : ''}
                      </Text>
                      <PrivilegeCountdown item={item} />
                    </View>
                  </View>
                )
              )
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Expired privileges" caption="Privileges that are no longer active" />
        <Card>
          {!expiredPrivileges.length ? <Text style={styles.empty}>No expired privileges yet.</Text> : expiredPrivileges.map((item) => <View key={item.id} style={styles.rewardRow}><View style={styles.rewardCopy}><Text style={styles.rewardName}>{item.rewardName}</Text><Text style={styles.rewardMeta}>Expired · {displayStamp(item)}</Text></View></View>)}
        </Card>
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:
      'row',
    gap: 15,
    alignItems:
      'flex-start',
    position: 'relative',
    zIndex: 1000,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
    paddingRight: 54,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },

  avatarPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor:
      colors.blueSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  avatarText: {
    color: colors.blueDark,
    fontSize: 30,
    fontWeight: '800',
  },


  editProfileButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editProfileText: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '700',
  },


  settingsWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 1001,
    alignItems: 'flex-end',
  },
  gearButton: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsMenu: {
    position: 'absolute',
    top: 58,
    right: 0,
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: 5,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 24,
    zIndex: 1002,
  },
  menuItem: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuText: { fontSize: 14, fontWeight: '700', color: colors.charcoal },
  deleteMenuText: { fontSize: 14, fontWeight: '700', color: colors.danger },
  menuDivider: { height: 1, backgroundColor: colors.gray200, marginHorizontal: 12 },

  pointsRow: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 14,
  },

  pointsValue: {
    color: colors.charcoal,
    fontSize: 30,
    fontWeight: '800',
  },

  pointsLabel: {
    color: colors.gray500,
  },

  summaryRow: {
    flexDirection:
      'row',
    gap: 10,
  },

  summaryCard: {
    flex: 1,
  },

  summaryValue: {
    color: colors.charcoal,
    fontSize: 25,
    fontWeight: '800',
  },

  summaryLabel: {
    color: colors.gray500,
    fontSize: 12,
    marginTop: 4,
  },

  section: {
    gap: 10,
  },

  rewardRow: {
    minHeight: 58,
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 10,
    borderBottomWidth: 0,
  },

  rewardIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor:
      colors.blueSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  rewardCopy: {
    flex: 1,
    gap: 2,
  },

  rewardName: {
    color: colors.charcoal,
    fontWeight: '700',
  },

  rewardMeta: {
    color: colors.gray500,
    fontSize: 12,
  },

  empty: {
    color: colors.gray500,
    lineHeight: 20,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
