import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  Share,
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
import EmptyState from '../components/EmptyState';
import AdaptiveName from '../components/AdaptiveName';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  getFamilyMembers,
  getHousehold,
  setAvailability,
  sendPatOnBack,
} from '../services/familyService';

import { colors } from '../theme/colors';

export default function FamilyScreen({
  navigation,
}) {
  const { profile } =
    useAuth();

  const [members, setMembers] =
    useState([]);

  const [household, setHousehold] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [workingId, setWorkingId] =
    useState('');

  const [error, setError] =
    useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setError('');

      try {
        const [
          family,
          home,
        ] =
          await Promise.all([
            getFamilyMembers(
              profile.householdId
            ),
            getHousehold(
              profile.householdId
            ),
          ]);

        setMembers(family);
        setHousehold(home);
      } catch (err) {
        setError(
          err.message ||
            'Could not load family.'
        );
      } finally {
        setLoading(false);
      }
    },
    [profile.householdId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleSick = async (
    member
  ) => {
    setWorkingId(member.id);
    setError('');

    try {
      const isAvailable =
        member.isAvailable !==
        false;

      await setAvailability(
        member.id,
        !isAvailable,
        isAvailable
          ? new Date(
              Date.now() +
                86400000
            )
              .toISOString()
              .slice(
                0,
                10
              )
          : null
      );

      await load();
    } catch (err) {
      setError(
        err.message ||
          'Could not update availability.'
      );
    } finally {
      setWorkingId('');
    }
  };

  const shareCode =
    async () => {
      if (
        !household?.inviteCode
      ) {
        return;
      }

      await Share.share({
        message:
          `Join our family in Coop. Use family code ${household.inviteCode}.`,
      });
    };

  const patOnBack = async (member) => {
    setWorkingId(`pat-${member.id}`);
    setError('');
    try {
      await sendPatOnBack({ householdId: profile.householdId, recipientId: member.id, senderName: profile.name || 'A family member' });
      Alert.alert('Thank you sent', `${member.name} received your message.`);
    } catch (err) {
      setError(err.message || 'Could not send the pat on the back.');
    } finally {
      setWorkingId('');
    }
  };

  const renderMemberActions = (member) => {
    const canManageSickMode = profile.role === 'parent';
    const canPat = profile.id !== member.id;
    return (
      <View style={styles.memberActions}>
        {canPat && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send a thumbs up to ${member.name}`}
            disabled={workingId === `pat-${member.id}`}
            onPress={() => patOnBack(member)}
            style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
          >
            <Ionicons name="thumbs-up-outline" size={19} color={colors.blueDark} />
          </Pressable>
        )}
        {canManageSickMode && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={member.isAvailable === false ? `Turn off sick mode for ${member.name}` : `Turn on sick mode for ${member.name}`}
            disabled={workingId === member.id}
            onPress={() => toggleSick(member)}
            style={({ pressed }) => [styles.iconAction, member.isAvailable === false && styles.iconActionActive, pressed && styles.pressed]}
          >
            <Ionicons name="bed-outline" size={19} color={member.isAvailable === false ? colors.warning : colors.gray700} />
          </Pressable>
        )}
      </View>
    );
  };

  const renderSickNotice = (member) => member.isAvailable === false ? (
    <View style={styles.sickNotice}>
      <Text style={styles.sickNoticeText}>
        Excused from chores. Streaks will not be broken and scheduled chores will not be assigned until sick mode is disabled.
      </Text>
    </View>
  ) : null;

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading family..." />
      </Screen>
    );
  }

  const parents =
    members.filter(
      (item) =>
        item.role ===
        'parent'
    );

  const kids =
    members.filter(
      (item) =>
        item.role ===
        'child'
    );

  return (
    <Screen>
      <PageHeader
        eyebrow="Family"
        title={
          household?.name ||
          'Our household'
        }
        subtitle={`${parents.length} parent${
          parents.length ===
          1
            ? ''
            : 's'
        } · ${kids.length} kid${
          kids.length ===
          1
            ? ''
            : 's'
        }`}
      />

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      {profile.role ===
        'parent' && (
        <Card
          style={
            styles.inviteCard
          }
        >
          <View
            style={
              styles.inviteTop
            }
          >
            <View
              style={
                styles.inviteIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={22}
                color={
                  colors.rust
                }
              />
            </View>

            <View
              style={
                styles.inviteCopy
              }
            >
              <Text
                style={
                  styles.inviteTitle
                }
              >
                Invite family members
              </Text>

              <Text
                style={
                  styles.inviteText
                }
              >
                Use this code to add another parent or a child.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={shareCode}
            style={
              styles.codeRow
            }
          >
            <View>
              <Text
                style={
                  styles.codeLabel
                }
              >
                Family code
              </Text>

              <Text
                selectable
                style={
                  styles.code
                }
              >
                {household?.inviteCode ||
                  '------'}
              </Text>
            </View>

            <Ionicons
              name="share-outline"
              size={20}
              color={
                colors.rust
              }
            />
          </Pressable>
        </Card>
      )}

      <View
        style={styles.section}
      >
        <SectionHeader
          title="Parents"
          caption="Tap a person to view their profile"
        />

        <Card>
          {parents.map(
            (
              member,
              index
            ) => (
              <React.Fragment key={member.id}>
                <MemberRow
                  member={member}
                  divider={
                    index <
                    parents.length -
                      1
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
                  actions={renderMemberActions(member)}
                />
                {renderSickNotice(member)}
              </React.Fragment>
            )
          )}
        </Card>
      </View>

      <View
        style={styles.section}
      >
        <SectionHeader
          title="Kids"
          caption="Points, chores, and availability"
        />

        {!kids.length ? (
          <Card>
            <EmptyState
              icon="person-add-outline"
              title="No child accounts yet"
              body="Share the family code when you are ready to add kids."
            />
          </Card>
        ) : (
          kids.map(
            (member) => (
              <Card
                key={
                  member.id
                }
              >
                <MemberRow
                  member={
                    member
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
                  actions={renderMemberActions(member)}
                />

                {renderSickNotice(member)}

              </Card>
            )
          )
        )}
      </View>
    </Screen>
  );
}

function MemberRow({
  member,
  divider,
  onPress,
  actions,
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.memberRow,
          divider && styles.memberDivider,
          pressed && styles.pressed,
        ]}
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
        style={styles.memberCopy}
      >
        <AdaptiveName
          style={styles.name}
        >
          {member.name}
        </AdaptiveName>

        <Text
          style={styles.meta}
        >
          {member.role ===
          'parent'
            ? 'Parent'
            : `${member.points || 0} points`}
        </Text>
      </View>

      {actions}

      <View
        style={[
          styles.statusDot,
          member.isAvailable ===
            false &&
            styles.statusDotOff,
        ]}
      />

      <Text
        style={styles.status}
      >
        {member.isAvailable ===
        false
          ? 'Excused'
          : 'Available'}
      </Text>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={
          colors.gray500
        }
      />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  inviteCard: {
    backgroundColor: colors.surface,
  },

  inviteTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.creamSoft,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  inviteCopy: {
    flex: 1,
    gap: 2,
  },

  inviteTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '800',
  },

  inviteText: {
    color: colors.gray700,
    fontSize: 13,
    lineHeight: 18,
  },

  codeRow: {
    backgroundColor: colors.white,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  codeLabel: {
    color: colors.rust,
    fontSize: 12,
    fontWeight: '700',
    textTransform:
      'uppercase',
    letterSpacing: 1,
  },

  code: {
    color: colors.charcoal,
    fontWeight: '800',
    fontSize: 28,
    letterSpacing: 4,
  },

  section: {
    gap: 10,
  },

  memberRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 8,
  },

  memberDivider: {
    borderBottomWidth: 0,
  },

  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  iconAction: {
    width: 38,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconActionActive: {
    backgroundColor: colors.warningSoft,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },

  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor:
      colors.blueSoft,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  avatarText: {
    color: colors.blueDark,
    fontSize: 16,
    fontWeight: '800',
  },

  memberCopy: {
    flex: 1,
    gap: 2,
  },

  name: {
    color: colors.charcoal,
    fontWeight: '800',
  },

  meta: {
    color: colors.gray500,
    fontSize: 13,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor:
      colors.success,
  },

  statusDotOff: {
    backgroundColor:
      colors.warning,
  },

  status: {
    color: colors.gray700,
    fontSize: 12,
    fontWeight: '600',
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
  },

  sickNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.warningSoft,
  },

  sickNoticeText: {
    flex: 1,
    color: colors.gray700,
    fontSize: 12,
    lineHeight: 17,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
