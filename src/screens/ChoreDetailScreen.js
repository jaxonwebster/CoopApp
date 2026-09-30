import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  format,
  parseISO,
} from 'date-fns';

import Screen from '../components/Screen';
import Card from '../components/Card';
import LoadingView from '../components/LoadingView';
import StatusPill from '../components/StatusPill';
import PrimaryButton from '../components/PrimaryButton';
import CelebrationOverlay from '../components/CelebrationOverlay';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  deleteChore,
  deleteChoreOccurrence,
  deleteFutureChoreOccurrences,
  getChore,
  submitChore,
  updateChore,
} from '../services/choreService';

import {
  uploadChoreProof,
} from '../services/storageService';

import {
  scheduleChoreReminder,
} from '../services/notificationService';

import {
  colors,
} from '../theme/colors';

export default function ChoreDetailScreen({
  route,
  navigation,
}) {
  const choreId =
    route.params?.choreId;

  const {
    profile,
  } = useAuth();

  const [chore, setChore] =
    useState(null);

  const [imageUri, setImageUri] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [reminding, setReminding] =
    useState(false);

  const [error, setError] =
    useState('');

  const [
    showCelebration,
    setShowCelebration,
  ] = useState(false);

  const [
    showReminderPicker,
    setShowReminderPicker,
  ] = useState(false);

  const [
    reminderTime,
    setReminderTime,
  ] = useState(
    new Date(
      Date.now() +
        60 * 60 * 1000
    )
  );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError('');

        try {
          const next =
            await getChore(
              choreId
            );

          setChore(next);

          if (
            next.reminderAt
          ) {
            setReminderTime(
              new Date(
                next.reminderAt
              )
            );
          }
        } catch (err) {
          setError(
            err.message ||
              'Could not load chore.'
          );
        } finally {
          setLoading(false);
        }
      },
      [choreId]
    );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const choosePhoto =
    async (
      useCamera
    ) => {
      setError('');

      let result;

      if (useCamera) {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (
          !permission.granted
        ) {
          setError(
            'Camera permission is required.'
          );

          return;
        }

        result =
          await ImagePicker.launchCameraAsync(
            {
              mediaTypes: [
                'images',
              ],
              quality: 0.8,
              allowsEditing:
                true,
              aspect: [
                4,
                3,
              ],
            }
          );
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
        ) {
          setError(
            'Photo library permission is required.'
          );

          return;
        }

        result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes: [
                'images',
              ],
              quality: 0.8,
              allowsEditing:
                true,
              aspect: [
                4,
                3,
              ],
            }
          );
      }

      if (
        !result.canceled &&
        result.assets?.length
      ) {
        setImageUri(
          result.assets[0].uri
        );
      }
    };

  const complete =
    async () => {
      if (
        !profile ||
        !chore
      ) {
        return;
      }

      if (
        chore.photoRequired &&
        !imageUri &&
        !chore.proofPhotoUrl
      ) {
        setError(
          'This chore requires photo proof.'
        );

        return;
      }

      setSaving(true);
      setError('');

      try {
        let photoUrl =
          chore.proofPhotoUrl ||
          null;

        if (
          imageUri
        ) {
          photoUrl =
            await uploadChoreProof({
              uri:
                imageUri,

              householdId:
                profile.householdId,

              userId:
                profile.id,

              choreId:
                chore.id,
            });
        }

        await submitChore({
          choreId:
            chore.id,

          photoUrl,

          requiresApproval:
            Boolean(
              chore.requiresApproval
            ),
        });

        setShowCelebration(
          true
        );

        setImageUri(null);

        await load();
      } catch (err) {
        setError(
          err.message ||
            'Could not complete chore.'
        );
      } finally {
        setSaving(false);
      }
    };

  const setReminder =
    async () => {
      setReminding(true);
      setError('');

      try {
        const now =
          new Date();

        if (
          reminderTime <=
          now
        ) {
          throw new Error(
            'Choose a time later today.'
          );
        }

        if (
          reminderTime.toDateString() !==
          now.toDateString()
        ) {
          throw new Error(
            'Reminders must be set for today.'
          );
        }

        const notificationId =
          await scheduleChoreReminder(
            {
              ...chore,
              reminderAt:
                reminderTime.toISOString(),
            }
          );

        await updateChore(
          chore.id,
          {
            reminderAt:
              reminderTime.toISOString(),

            reminderNotificationId:
              notificationId,

            reminderSet:
              true,
          }
        );

        await load();
      } catch (err) {
        setError(
          err.message ||
            'Could not set reminder.'
        );
      } finally {
        setReminding(
          false
        );

        setShowReminderPicker(
          false
        );
      }
    };

  const remove =
    async () => {
      try {
        if (occurrenceOnly) {
          await deleteChoreOccurrence(chore.id, chore.assignedDate);
        } else {
          await deleteChore(chore.id);
        }

        navigation.goBack();
      } catch (err) {
        setError(
          err.message ||
            'Could not delete chore.'
        );
      }
    };

  const removeFutureOccurrences = () => {
    Alert.alert(
      'Delete all future occurrences?',
      'This will remove this occurrence and all later occurrences while preserving earlier history.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete future occurrences',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            setError('');

            try {
              await deleteFutureChoreOccurrences(
                chore.id,
                chore.assignedDate
              );
              navigation.goBack();
            } catch (err) {
              setError(
                err.message ||
                  'Could not delete future occurrences.'
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading chore..." />
      </Screen>
    );
  }

  if (!chore) {
    return (
      <Screen>
        <Text
          style={styles.error}
        >
          {error ||
            'Chore not found.'}
        </Text>
      </Screen>
    );
  }

  /*
   * IMPORTANT:
   *
   * Any family member can complete a chore
   * assigned to themselves.
   *
   * That includes parents.
   */
  const assignedToMe =
    chore.assignedTo ===
    profile?.id;

  const occurrenceOnly = Boolean(
    chore.recurring &&
    chore.id !== (chore.seriesId || chore.id)
  );

  const recurringScheduledToday =
    !chore.recurring ||
    chore.assignedDate === format(new Date(), 'yyyy-MM-dd');

  const canComplete =
    assignedToMe &&
    chore.status ===
      'pending' &&
    recurringScheduledToday;

  /*
   * A parent can manage chores that belong
   * to other family members.
   */
  const parentManagingSomeoneElse =
    profile?.role ===
      'parent' &&
    chore.assignedTo !==
      profile.id;

  return (
    <View
      style={styles.root}
    >
      <Screen>
        <Card>
          <Text
            style={styles.title}
          >
            {chore.title}
          </Text>

          <View
            style={
              styles.statusRow
            }
          >
            <StatusPill
              status={
                chore.status
              }
            />

            <Text
              style={
                styles.points
              }
            >
              {chore.points ||
                0}{' '}
              points
            </Text>
          </View>

          {!!chore.assignedToName && (
            <Text
              style={styles.meta}
            >
              Assigned to{' '}
              {
                chore.assignedToName
              }
            </Text>
          )}

          {!!chore.dueDate && !chore.recurring && (
            <Text style={styles.meta}>
              Due {format(parseISO(chore.dueDate), 'EEEE, MMMM d')}
            </Text>
          )}

          {assignedToMe && chore.status === 'pending' && chore.recurring && !recurringScheduledToday && (
            <Text style={styles.scheduleNote}>This recurring chore can be completed on its scheduled day.</Text>
          )}

          {chore.description && (
            <>
              <View
                style={
                  styles.divider
                }
              />

              <Text
                style={
                  styles.description
                }
              >
                {
                  chore.description
                }
              </Text>
            </>
          )}

          {chore.requiresApproval && (
            <View style={styles.approvalBox}>
              <Ionicons name="shield-checkmark-outline" size={17} color={colors.blueDark} />
              <Text style={styles.approvalTitle}>Parent approval required</Text>
            </View>
          )}
        </Card>

        {!!error && (
          <Text
            style={styles.error}
          >
            {error}
          </Text>
        )}

        {canComplete && (
          <Card>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Complete this chore
            </Text>

            {chore.photoRequired && (
              <View
                style={
                  styles.buttonGroup
                }
              >
                <PrimaryButton
                  title="Take photo"
                  variant="secondary"
                  onPress={() =>
                    choosePhoto(
                      true
                    )
                  }
                />

                <PrimaryButton
                  title="Choose photo"
                  variant="secondary"
                  onPress={() =>
                    choosePhoto(
                      false
                    )
                  }
                />
              </View>
            )}

            <PrimaryButton
              title={
                chore.requiresApproval
                  ? 'Submit for approval'
                  : 'Complete chore'
              }
              onPress={
                complete
              }
              loading={
                saving
              }
            />
          </Card>
        )}

        {canComplete &&
          !chore.reminderSet && (
          <Card>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Need a reminder?
            </Text>

            <Text
              style={
                styles.reminderText
              }
            >
              Choose a time later today and Coop will remind you.
            </Text>

            {!showReminderPicker ? (
              <PrimaryButton
                title="Remind me later"
                variant="secondary"
                onPress={() =>
                  setShowReminderPicker(
                    true
                  )
                }
              />
            ) : (
              <View
                style={
                  styles.pickerBox
                }
              >
                <DateTimePicker
                  value={
                    reminderTime
                  }
                  mode="time"
                  display={
                    Platform.OS ===
                    'ios'
                      ? 'spinner'
                      : 'default'
                  }
                  onChange={(
                    event,
                    selected
                  ) => {
                    if (
                      selected
                    ) {
                      const next =
                        new Date();

                      next.setHours(
                        selected.getHours(),
                        selected.getMinutes(),
                        0,
                        0
                      );

                      setReminderTime(
                        next
                      );
                    }
                  }}
                />

                <PrimaryButton
                  title="Set reminder"
                  onPress={
                    setReminder
                  }
                  loading={
                    reminding
                  }
                />
              </View>
            )}
          </Card>
        )}

        {canComplete &&
          chore.reminderSet && (
          <Card
            style={
              styles.reminderSet
            }
          >
            <Text
              style={
                styles.reminderSetTitle
              }
            >
              Reminder set
            </Text>

            <Text
              style={
                styles.reminderSetText
              }
            >
              {chore.reminderAt
                ? format(
                    new Date(
                      chore.reminderAt
                    ),
                    'h:mm a'
                  )
                : 'Later today'}
            </Text>
          </Card>
        )}

        {chore.proofPhotoUrl && (
          <Card>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Submitted proof
            </Text>

            <Image
              source={{
                uri:
                  chore.proofPhotoUrl,
              }}
              style={styles.photo}
            />
          </Card>
        )}

        {imageUri && (
          <Card>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Selected proof
            </Text>

            <Image
              source={{
                uri: imageUri,
              }}
              style={styles.photo}
            />
          </Card>
        )}

        {parentManagingSomeoneElse && (
          <View
            style={
              styles.buttonGroup
            }
          >
            <PrimaryButton
              title="Edit chore"
              variant="secondary"
              onPress={() =>
                navigation.navigate(
                  'ChoreForm',
                  {
                    choreId:
                      chore.id,
                    ...(occurrenceOnly ? {occurrenceDate: chore.assignedDate, occurrenceOnly: true} : {}),
                  }
                )
              }
            />

            <PrimaryButton
              title={occurrenceOnly ? 'Delete occurrence' : 'Delete chore'}
              variant="danger"
              onPress={
                remove
              }
            />

            {occurrenceOnly && (
              <PrimaryButton
                title="Delete all future occurrences"
                variant="danger"
                onPress={removeFutureOccurrences}
                disabled={saving}
              />
            )}
          </View>
        )}

        {profile?.role ===
          'parent' &&
          assignedToMe && (
          <View
            style={
              styles.buttonGroup
            }
          >
            <PrimaryButton
              title="Edit chore"
              variant="secondary"
              onPress={() =>
                navigation.navigate(
                  'ChoreForm',
                  {
                    choreId:
                      chore.id,
                    ...(occurrenceOnly ? {occurrenceDate: chore.assignedDate, occurrenceOnly: true} : {}),
                  }
                )
              }
            />

            <PrimaryButton
              title={occurrenceOnly ? 'Delete occurrence' : 'Delete chore'}
              variant="danger"
              onPress={
                remove
              }
            />

            {occurrenceOnly && (
              <PrimaryButton
                title="Delete all future occurrences"
                variant="danger"
                onPress={removeFutureOccurrences}
                disabled={saving}
              />
            )}
          </View>
        )}
      </Screen>

      <CelebrationOverlay
        visible={
          showCelebration
        }
        message={
          chore.requiresApproval
            ? 'Submitted!'
            : `+${chore.points || 0} points`
        }
        onDone={() =>
          setShowCelebration(
            false
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.charcoal,
  },

  statusRow: {
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'space-between',
    gap: 12,
  },

  points: {
    color: colors.blueDark,
    fontWeight: '800',
  },

  meta: {
    color: colors.gray500,
    fontSize: 14,
  },

  scheduleNote: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },

  divider: {
    height: 0,
  },

  description: {
    color: colors.charcoal,
    fontSize: 16,
    lineHeight: 23,
  },

  approvalBox: {
    backgroundColor: colors.blueSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },

  approvalTitle: {
    color: colors.blueDark,
    fontWeight: '800',
  },

  approvalText: {
    color: colors.gray700,
    lineHeight: 19,
  },

  instantBox: {
    backgroundColor:
      colors.successSoft,
    borderRadius: 14,
    padding: 14,
  },

  instantTitle: {
    color: colors.success,
    fontWeight: '800',
  },

  sectionTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '800',
  },

  buttonGroup: {
    gap: 10,
  },

  reminderText: {
    color: colors.gray500,
    fontSize: 13,
    lineHeight: 19,
  },

  pickerBox: {
    gap: 10,
  },

  reminderSet: {
    backgroundColor:
      colors.successSoft,
  },

  reminderSetTitle: {
    color: colors.success,
    fontWeight: '800',
  },

  reminderSetText: {
    color: colors.gray700,
    marginTop: 3,
  },

  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 15,
    backgroundColor:
      colors.gray200,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    lineHeight: 19,
  },
});
