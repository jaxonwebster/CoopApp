import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

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
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  getHouseholdChores,
  isMissedChore,
  deleteChore,
  reassignMissedChore,
  dismissMissedChore,
} from '../services/choreService';

import { colors } from '../theme/colors';

export default function MissedChoresScreen({
  navigation,
}) {
  const { profile } =
    useAuth();

  const [chores, setChores] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [workingId, setWorkingId] = useState('');

  const load = useCallback(
    async () => {
      setLoading(true);
      setError('');

      try {
        const all =
          await getHouseholdChores(
            profile.householdId
          );

        setChores(
          all.filter(
            isMissedChore
          )
        );
      } catch (err) {
        setError(
          err.message ||
            'Could not load missed chores.'
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

  const grouped =
    useMemo(() => {
      const groups = {};

      chores.forEach(
        (chore) => {
          groups[
            chore.dueDate || chore.assignedDate
          ] ||= [];

          groups[
            chore.dueDate || chore.assignedDate
          ].push(chore);
        }
      );

      return Object.entries(
        groups
      ).sort(
        (a, b) =>
          b[0].localeCompare(
            a[0]
          )
      );
    }, [chores]);

  const reassign = async (chore) => {
    setWorkingId(chore.id);
    setError('');
    try {
      await reassignMissedChore(chore.id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not re-assign chore.');
    } finally {
      setWorkingId('');
    }
  };

  const remove = (chore) => Alert.alert('Delete chore?', `Delete ${chore.title}?`, [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Delete', style: 'destructive', onPress: async () => {
      setWorkingId(`delete-${chore.id}`); setError('');
      try { await deleteChore(chore.id); await load(); }
      catch (err) { setError(err.message || 'Could not delete chore.'); }
      finally { setWorkingId(''); }
    }},
  ]);

  const dismiss = (chore) => Alert.alert(
    'Dismiss missed chore?',
    `Excuse only this missed occurrence of ${chore.title}? The recurring schedule will stay active.`,
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Dismiss', onPress: async () => {
        setWorkingId(`dismiss-${chore.id}`);
        setError('');
        try {
          await dismissMissedChore(chore.id);
          await load();
        } catch (err) {
          setError(err.message || 'Could not dismiss chore.');
        } finally {
          setWorkingId('');
        }
      }},
    ]
  );

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading missed chores..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Parent tools"
        title="Missed chores"
        subtitle="Past chores that are still incomplete."
      />

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      {!grouped.length ? (
        <Card>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Nothing missed"
            body="Every scheduled chore is accounted for."
          />
        </Card>
      ) : (
        grouped.map(
          ([
            date,
            dayChores,
          ]) => (
            <Card key={date}>
              <Text
                style={
                  styles.dateTitle
                }
              >
                {format(
                  parseISO(date),
                  'EEEE, MMMM d'
                )}
              </Text>

              {dayChores.map(
                (chore, index) => (
                  <View
                    key={
                      chore.id
                    }
                    style={
                      [
                        styles.choreItem,
                        index > 0 && styles.choreItemSeparated,
                      ]
                    }
                  >
                    <View
                      style={
                        styles.copy
                      }
                    >
                      <Text
                        style={
                          styles.choreTitle
                        }
                      >
                        {
                          chore.title
                        }
                      </Text>

                      <Text
                        style={
                          styles.meta
                        }
                      >
                        {
                          chore.assignedToName
                        }
                        {' · '}
                        {chore.points ||
                          0}{' '}
                        points
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <PrimaryButton
                        title="Reassign"
                        compact
                        variant="secondary"
                        style={styles.actionButton}
                        loading={workingId === chore.id}
                        onPress={() => reassign(chore)}
                      />
                      <PrimaryButton
                        title="Dismiss"
                        compact
                        variant="ghost"
                        style={styles.actionButton}
                        loading={workingId === `dismiss-${chore.id}`}
                        onPress={() => dismiss(chore)}
                      />
                      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${chore.title}`} disabled={workingId === `delete-${chore.id}`} onPress={() => remove(chore)} style={({pressed}) => [styles.deleteButton, pressed && styles.pressed]}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                )
              )}
            </Card>
          )
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateTitle: {
    color: colors.charcoal,
    fontSize: 17,
    fontWeight: '800',
  },

  choreItem: {
    paddingTop: 14,
    gap: 12,
  },

  choreItemSeparated: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  copy: {
    flex: 1,
    gap: 3,
  },

  choreTitle: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '800',
  },

  meta: {
    color: colors.gray500,
    fontSize: 13,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  actionButton: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
  },
  deleteButton: {width: 40, height: 40, borderRadius: 12, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center'},
  pressed: {opacity: 0.78, transform: [{scale: 0.98}]},
});
