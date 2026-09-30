import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '../components/Screen';
import Card from '../components/Card';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import LoadingView from '../components/LoadingView';

import { useAuth } from '../contexts/AuthContext';

import {
  getFamilyMembers,
  startHomeReset,
} from '../services/familyService';

import { colors } from '../theme/colors';

const RESET_TASKS = [
  'Pick up toys',
  'Clear kitchen counters',
  'Load dishwasher',
  'Unload dishwasher',
  'Wipe table',
  'Sweep floor',
  'Vacuum floor',
  'Mop floor',
  'Put away shoes',
  'Wipe bathroom sink',
  'Clean toilet',
  'Take out trash',
  'Fold laundry',
  'Put away laundry',
  'Make bed',
  'Tidy bedroom',
  'Tidy living room',
];

export default function HomeResetScreen({
  navigation,
}) {
  const { profile } = useAuth();

  const [children, setChildren] =
    useState([]);

  const [
    selectedTasks,
    setSelectedTasks,
  ] = useState(
    RESET_TASKS.slice(0, 4)
  );

  const [
    selectedChildren,
    setSelectedChildren,
  ] = useState([]);

  const [customTask, setCustomTask] = useState('');
  const [customTasks, setCustomTasks] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async () => {
      setLoading(true);

      try {
        const members =
          await getFamilyMembers(
            profile.householdId
          );

        const kids = members; // Quick Cleanup can include parents and children.

        setChildren(kids);

        setSelectedChildren(
          kids
            .filter(
              (item) =>
                item.isAvailable !==
                false
            )
            .map((item) => item.id)
        );
      } catch (err) {
        setError(
          err.message ||
            'Could not load family members.'
        );
      } finally {
        setLoading(false);
      }
    },
    [profile.householdId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const participants =
    useMemo(
      () =>
        children.filter(
          (item) =>
            selectedChildren.includes(
              item.id
            )
        ),
      [
        children,
        selectedChildren,
      ]
    );

  const toggleTask = (task) => {
    setSelectedTasks(
      (prev) =>
        prev.includes(task)
          ? prev.filter(
              (item) =>
                item !== task
            )
          : [...prev, task]
    );
  };

  const toggleChild = (id) => {
    setSelectedChildren(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (item) =>
                item !== id
            )
          : [...prev, id]
    );
  };

  const addCustomTask = () => {
    const task = customTask.trim();
    if (!task) return;

    const existingTask = [...RESET_TASKS, ...customTasks]
      .find((item) => item.toLowerCase() === task.toLowerCase());

    if (existingTask) {
      setSelectedTasks((prev) => prev.includes(existingTask) ? prev : [...prev, existingTask]);
      setCustomTask('');
      return;
    }

    setCustomTasks((prev) => [...prev, task]);
    setSelectedTasks((prev) => [...prev, task]);
    setCustomTask('');
  };

  const start = async () => {
    setSaving(true);
    setError('');

    try {
      await startHomeReset({
        householdId:
          profile.householdId,
        parentId: profile.id,
        tasks: selectedTasks,
        children: participants,
      });

      navigation.navigate('Home');
    } catch (err) {
      setError(
        err.message ||
          'Could not start Quick Cleanup.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Preparing Quick Cleanup..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>
        Quick Cleanup
      </Text>

      <Text style={styles.subtitle}>
        Pick a few quick cleanup jobs and
        Coop will distribute them among
        selected family members.
      </Text>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          One point per task
        </Text>

        <Text style={styles.infoText}>
          Quick Cleanup chores are designed to
          be quick. They are worth 1 point
          each and never require parent approval.
        </Text>
      </Card>

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      <Card>
        <Text style={styles.section}>
          Choose tasks
        </Text>

        <View style={styles.wrap}>
          {[...RESET_TASKS, ...customTasks].map(
            (task) => (
              <Chip
                key={task}
                label={task}
                selected={selectedTasks.includes(
                  task
                )}
                onPress={() =>
                  toggleTask(task)
                }
              />
            )
          )}
        </View>

        <View style={styles.customTaskRow}>
          <View style={styles.customTaskInput}>
            <FormField
              label="Custom chore"
              value={customTask}
              onChangeText={setCustomTask}
              placeholder="Example: Wipe the front door"
              returnKeyType="done"
              onSubmitEditing={addCustomTask}
            />
          </View>
          <Pressable style={styles.addCustomButton} onPress={addCustomTask}>
            <Text style={styles.addCustomButtonText}>Add</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>
          Choose helpers
        </Text>

        {!children.length && (
          <Text style={styles.note}>
            No family members are available.
          </Text>
        )}

        <View style={styles.wrap}>
          {children.map(
            (child) => (
              <Chip
                key={child.id}
                label={`${child.name}${
                  child.isAvailable ===
                  false
                    ? ' (excused)'
                    : ''
                }`}
                selected={selectedChildren.includes(
                  child.id
                )}
                disabled={
                  child.isAvailable ===
                  false
                }
                onPress={() =>
                  toggleChild(
                    child.id
                  )
                }
              />
            )
          )}
        </View>
      </Card>

      <PrimaryButton
        title={`Start reset (${selectedTasks.length} tasks)`}
        onPress={start}
        loading={saving}
        disabled={
          !selectedTasks.length ||
          !participants.length
        }
      />
    </Screen>
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected &&
          styles.chipSelected,
        disabled &&
          styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected &&
            styles.chipTextSelected,
        ]}
      >
        {selected
          ? '✓ '
          : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.charcoal,
  },

  subtitle: {
    color: colors.gray700,
    lineHeight: 22,
    fontSize: 16,
  },

  infoCard: {
    backgroundColor: colors.white,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
  },

  infoText: {
    color: colors.gray700,
    lineHeight: 20,
  },

  section: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal,
  },

  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },

  customTaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 18,
  },

  customTaskInput: {
    flex: 1,
  },

  addCustomButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addCustomButtonText: {
    color: colors.blueDark,
    fontWeight: '800',
  },

  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor:
      colors.white,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  chipSelected: {
    backgroundColor:
      colors.blueSoft,
    borderColor: colors.blue,
  },

  chipDisabled: {
    opacity: 0.45,
  },

  chipText: {
    color: colors.gray700,
    fontWeight: '700',
  },

  chipTextSelected: {
    color: colors.charcoal,
  },

  note: {
    color: colors.gray700,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
  },
});
