import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Image,
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
import SectionHeader from '../components/SectionHeader';
import PrivilegeCountdown from '../components/PrivilegeCountdown';
import WeeklyCalendar from '../components/WeeklyCalendar';
import AdaptiveName from '../components/AdaptiveName';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  getHouseholdChores,
} from '../services/choreService';

import {
  getUserProfile,
  removeChildFromFamily,
} from '../services/familyService';

import {
  getHouseholdRedemptions,
  isPrivilegeActive as activePrivilege,
  removePrivilege,
} from '../services/rewardService';

import {
  colors,
} from '../theme/colors';

import {
  formatAmericanDate,
  formatAmericanDateTime,
} from '../utils/dateFormatters';

function displayStamp(item){return formatAmericanDateTime(item.reviewedAt||item.createdAt)||formatAmericanDate(item.redeemedDate)||'';}

export default function MemberProfileScreen({
  route,
  navigation,
}) {
  const memberId =
    route.params?.memberId;

  const {
    profile,
  } = useAuth();

  const [member, setMember] =
    useState(null);

  const [chores, setChores] =
    useState([]);

  const [redemptions, setRedemptions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');
  const [, setPrivilegeClock] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setPrivilegeClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const removeReward = (item) => Alert.alert('Remove reward?', `Remove ${item.rewardName} from ${member?.name || 'this child'}?`, [{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{try{await removePrivilege(item);await load();}catch(e){setError(e.message||'Could not remove reward.');}}}]);

  const removeChild = () => Alert.alert(
    'Remove from family?',
    `Remove ${member?.name || 'this child'} from your Coop family? Their Coop account will be removed and they will no longer have access to this family.`,
    [
      {text:'Cancel', style:'cancel'},
      {text:'Remove', style:'destructive', onPress:async()=>{
        try {
          setLoading(true);
          await removeChildFromFamily(memberId);
          navigation.goBack();
        } catch(e) {
          setLoading(false);
          setError(e.message || 'Could not remove this child from the family.');
        }
      }},
    ]
  );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError('');

        try {
          const [
            nextMember,
            familyChores,
            rewards,
          ] =
            await Promise.all([
              getUserProfile(
                memberId
              ),

              getHouseholdChores(
                profile.householdId
              ),

              getHouseholdRedemptions(
                profile.householdId
              ),
            ]);

          if (
            !nextMember ||
            nextMember.householdId !==
              profile.householdId
          ) {
            throw new Error(
              'That family member could not be found.'
            );
          }

          setMember(
            nextMember
          );

          setChores(
            familyChores
          );

          // Parent profiles load household redemptions, then filter locally for
          // the selected child. This keeps the parent view in sync with the
          // child's own privilege list and avoids a separate compound query.
          setRedemptions(
            rewards.filter((item) => item.userId === memberId)
          );
        } catch (err) {
          setError(
            err.message ||
              'Could not load family member.'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        memberId,
        profile.householdId,
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
        <LoadingView label="Loading family member..." />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen>
        <Text
          style={styles.error}
        >
          {error ||
            'Profile not found.'}
        </Text>
      </Screen>
    );
  }

  const approvedRewards =
    redemptions.filter(
      (item) => item.status === 'approved' && activePrivilege(item)
    );

  const memberCompleted =
    chores.filter(
      (chore) =>
        chore.assignedTo ===
          memberId &&
        chore.status ===
          'completed'
    );

  return (
    <Screen>
      <View
        style={styles.header}
      >
        {member.profilePhotoUrl ? (
          <Image
            source={{
              uri:
                member.profilePhotoUrl,
            }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={
              styles.avatarPlaceholder
            }
          >
            <Text
              style={
                styles.avatarText
              }
            >
              {member.name
                ?.charAt(0)
                ?.toUpperCase() ||
                '?'}
            </Text>
          </View>
        )}

        <View
          style={
            styles.headerCopy
          }
        >
          <AdaptiveName
            style={styles.name}
          >
            {member.name}
          </AdaptiveName>

          <Text
            style={styles.role}
          >
            {member.role ===
            'parent'
              ? 'Parent'
              : 'Kid'}
          </Text>

          <Text
            style={styles.points}
          >
            {member.points ||
              0}{' '}
            points
          </Text>
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
        <WeeklyCalendar
          chores={
            chores
          }
          userId={
            memberId
          }
          title="Personal week"
          subtitle="Their completed chore activity."
        />
      </Card>

      <View
        style={styles.section}
      >
        <SectionHeader
          title="Privileges"
          caption="Rewards this family member has earned"
        />

        <Card>
          {!approvedRewards.length ? (
            <Text
              style={
                styles.empty
              }
            >
              No approved privileges yet.
            </Text>
          ) : (
            approvedRewards.map(
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
                      Earned {displayStamp(item)}
                    </Text>
                    <PrivilegeCountdown item={item} />
                  </View>

                  {profile.role==='parent' ? <Pressable onPress={()=>removeReward(item)} style={{padding:8}}><Ionicons name="trash-outline" size={17} color={colors.danger}/></Pressable> : <Text style={styles.approved}>Earned</Text>}
                </View>
              )
            )
          )}
        </Card>
      </View>

      <Card>
        <View
          style={
            styles.statsRow
          }
        >
          <View>
            <Text
              style={
                styles.statsValue
              }
            >
              {
                memberCompleted.length
              }
            </Text>

            <Text
              style={
                styles.statsLabel
              }
            >
              Chores completed
            </Text>
          </View>

          <View>
            <Text
              style={
                styles.statsValue
              }
            >
              {
                approvedRewards.length
              }
            </Text>

            <Text
              style={
                styles.statsLabel
              }
            >
              Privileges earned
            </Text>
          </View>
        </View>
      </Card>
      {profile.role === 'parent' && member.role === 'child' && (
        <Pressable style={styles.removeChildButton} onPress={removeChild}>
          <Ionicons name="person-remove-outline" size={17} color={colors.danger} />
          <Text style={styles.removeChildText}>Remove from family</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 15,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 25,
  },

  avatarPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 25,
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

  headerCopy: {
    flex: 1,
    gap: 4,
  },

  name: {
    color: colors.charcoal,
    fontSize: 28,
    fontWeight: '800',
  },

  role: {
    color: colors.gray500,
    fontSize: 14,
  },

  points: {
    color: colors.blueDark,
    fontWeight: '800',
  },

  removeChildButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
  },

  removeChildText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
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

  rewardIconPending: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor:
      colors.creamSoft,
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

  approved: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },

  pending: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },

  statsRow: {
    flexDirection:
      'row',
    justifyContent:
      'space-around',
  },

  statsValue: {
    textAlign:
      'center',
    color: colors.charcoal,
    fontSize: 24,
    fontWeight: '800',
  },

  statsLabel: {
    color: colors.gray500,
    fontSize: 12,
    marginTop: 3,
  },

  empty: {
    color: colors.gray500,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
  },
});
