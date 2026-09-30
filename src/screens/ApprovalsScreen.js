import React, {
  useCallback,
  useState,
} from 'react';

import {
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
import PrimaryButton from '../components/PrimaryButton';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  approveChore,
  getHouseholdChores,
  rejectChore,
} from '../services/choreService';

import {
  colors,
} from '../theme/colors';

export default function ApprovalsScreen() {
  const {
    profile,
  } = useAuth();

  const [
    choreRequests,
    setChoreRequests,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    workingId,
    setWorkingId,
  ] = useState('');

  const [error, setError] =
    useState('');

  const load =
    useCallback(
      async () => {
        if (
          !profile?.householdId
        ) {
          return;
        }

        setLoading(true);
        setError('');

        try {
          const allChores = await getHouseholdChores(profile.householdId);

          setChoreRequests(
            allChores.filter(
              (chore) =>
                chore.status ===
                'awaitingApproval'
            )
          );

        } catch (err) {
          console.log(
            'APPROVALS LOAD ERROR:',
            err
          );

          setError(
            err.message ||
              'Could not load approval requests.'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        profile?.householdId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const approveSubmittedChore =
    async (chore) => {
      setWorkingId(
        chore.id
      );
      setError('');

      try {
        await approveChore(
          chore.id
        );

        await load();
      } catch (err) {
        setError(
          err.message ||
            'Could not approve chore.'
        );
      } finally {
        setWorkingId('');
      }
    };

  const rejectSubmittedChore =
    async (chore) => {
      setWorkingId(
        chore.id
      );
      setError('');

      try {
        await rejectChore(
          chore.id,
          'Please complete the chore and submit it again.'
        );

        await load();
      } catch (err) {
        setError(
          err.message ||
            'Could not reject chore.'
        );
      } finally {
        setWorkingId('');
      }
    };

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading requests..." />
      </Screen>
    );
  }

  const total = choreRequests.length;

  return (
    <Screen>
      <PageHeader
        eyebrow="Parent tools"
        title="Approvals"
        subtitle={
          total
            ? `${total} item${
                total === 1
                  ? ''
                  : 's'
              } waiting for you`
            : 'Nothing is waiting for you right now.'
        }
      />

      {!!error && (
        <Text
          style={styles.error}
        >
          {error}
        </Text>
      )}

      {total === 0 ? (
        <Card
          style={
            styles.emptyCard
          }
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={34}
            color={
              colors.success
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            You're all caught up
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            New chore submissions will appear here.
          </Text>
        </Card>
      ) : (
        <>
          {choreRequests.length >
            0 && (
            <View
              style={
                styles.section
              }
            >
              <SectionHeader
                title="Chore submissions"
                caption={`${choreRequests.length} waiting`}
              />

              {choreRequests.map(
                (chore) => (
                  <Card
                    key={
                      chore.id
                    }
                  >
                    <View
                      style={
                        styles.requestTop
                      }
                    >
                      <View
                        style={
                          styles.icon
                        }
                      >
                        <Ionicons
                          name="checkmark-done-outline"
                          size={21}
                          color={
                            colors.blueDark
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.copy
                        }
                      >
                        <Text
                          style={
                            styles.title
                          }
                        >
                          {
                            chore.title
                          }
                        </Text>

                        <Text
                          style={
                            styles.subtitle
                          }
                        >
                          {
                            chore.assignedToName
                          }{' '}
                          submitted this chore.
                        </Text>
                      </View>
                    </View>

                    {chore.proofPhotoUrl && (
                      <Image
                        source={{
                          uri:
                            chore.proofPhotoUrl,
                        }}
                        style={
                          styles.photo
                        }
                        accessibilityLabel="Chore proof photo"
                      />
                    )}

                    <Text
                      style={
                        styles.pending
                      }
                    >
                      {
                        chore.points ||
                        0
                      }{' '}
                      points will be awarded when approved.
                    </Text>

                    <View
                      style={
                        styles.buttons
                      }
                    >
                      <PrimaryButton
                        title="Approve"
                        loading={
                          workingId ===
                          chore.id
                        }
                        onPress={() =>
                          approveSubmittedChore(
                            chore
                          )
                        }
                      />

                      <PrimaryButton
                        title="Reject"
                        variant="secondary"
                        disabled={
                          workingId ===
                          chore.id
                        }
                        onPress={() =>
                          rejectSubmittedChore(
                            chore
                          )
                        }
                      />
                    </View>
                  </Card>
                )
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },

  requestTop: {
    flexDirection:
      'row',
    alignItems:
      'flex-start',
    gap: 12,
  },

  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor:
      colors.blueSoft,
    alignItems:
      'center',
    justifyContent:
      'center',
  },

  copy: {
    flex: 1,
    gap: 4,
  },

  title: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '800',
  },

  subtitle: {
    color: colors.gray500,
    fontSize: 13,
    lineHeight: 19,
  },

  pending: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },

  buttons: {
    gap: 9,
  },

  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 15,
  },

  emptyCard: {
    alignItems:
      'center',
    gap: 10,
    paddingVertical:
      30,
  },

  emptyTitle: {
    color: colors.charcoal,
    fontSize: 19,
    fontWeight: '800',
  },

  emptyText: {
    color: colors.gray500,
    textAlign:
      'center',
    lineHeight: 20,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
    lineHeight: 19,
  },
});
