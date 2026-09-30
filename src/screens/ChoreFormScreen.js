import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import Screen from '../components/Screen';
import Card from '../components/Card';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import LoadingView from '../components/LoadingView';
import AdaptiveName from '../components/AdaptiveName';

import { useAuth } from '../contexts/AuthContext';

import {
  createChore,
  deleteChoreOccurrence,
  deleteFutureChoreOccurrences,
  getChore,
  updateChoreOccurrence,
  updateChore,
} from '../services/choreService';

import {
  getFamilyMembers,
} from '../services/familyService';

import { colors } from '../theme/colors';

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}



export default function ChoreFormScreen({
  route,
  navigation,
}) {
  const choreId =
    route.params?.choreId;
  const occurrenceDate = route.params?.occurrenceDate;
  const occurrenceOnly = Boolean(route.params?.occurrenceOnly && occurrenceDate);

  const { profile } =
    useAuth();

  const [members, setMembers] =
    useState([]);

  const [title, setTitle] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [points, setPoints] =
    useState('10');

  const [dueDate, setDueDate] = useState('');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);



  const [assignedTo, setAssignedTo] =
    useState('');
  const [assignees, setAssignees] = useState([]);

  const [openToAnyone, setOpenToAnyone] = useState(false);

  const [photoRequired, setPhotoRequired] =
    useState(false);

  const [
    requiresApproval,
    setRequiresApproval,
  ] = useState(false);

  const [recurring, setRecurring] =
    useState(false);

  const [
    recurrenceFrequency,
    setRecurrenceFrequency,
  ] = useState('daily');

  const [
    selectedWeekdays,
    setSelectedWeekdays,
  ] = useState([
    new Date().getDay(),
  ]);



  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const load = useCallback(
    async () => {
      if (
        !profile?.householdId
      ) {
        return;
      }

      setLoading(true);

      try {
        const family =
          await getFamilyMembers(
            profile.householdId
          );

        setMembers(family);

        const firstAvailable = family.find((member) => member.isAvailable !== false);
        if (!choreId && firstAvailable) {
          setAssignedTo((current) => current || firstAvailable.id);
          setAssignees((current) => current.length ? current : [firstAvailable.id]);
        }

        if (choreId) {
          const chore =
            await getChore(
              choreId
            );

          setTitle(
            chore.title || ''
          );

          setDescription(
            chore.description ||
              ''
          );

          setPoints(
            String(
              chore.points ??
                10
            )
          );

          setDueDate(chore.recurring ? '' : (chore.dueDate || chore.assignedDate || ''));

          setAssignedTo(chore.assignedTo || firstAvailable?.id || '');
          setAssignees(chore.assignedTo ? [chore.assignedTo] : []);
          setOpenToAnyone(Boolean(chore.openToAnyone));

          setPhotoRequired(
            Boolean(chore.photoRequired && chore.requiresApproval)
          );

          setRequiresApproval(
            Boolean(
              chore.requiresApproval
            )
          );

          setRecurring(
            Boolean(
              chore.recurring
            )
          );

          if (
            chore.recurrence
              ?.frequency
          ) {
            setRecurrenceFrequency(
              chore.recurrence.frequency === 'daily' ? 'daily' : 'custom'
            );
          }

          if (
            Array.isArray(
              chore.recurrence
                ?.weekdays
            )
          ) {
            setSelectedWeekdays(
              chore.recurrence
                .weekdays
            );
          }
        }
      } catch (err) {
        setError(
          err.message ||
            'Could not load chore form.'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      profile?.householdId,
      choreId,
      occurrenceDate,
      occurrenceOnly,
    ]
  );

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (
    day
  ) => {
    setSelectedWeekdays(
      (current) => {
        if (
          current.includes(
            day
          )
        ) {
          if (
            current.length ===
            1
          ) {
            return current;
          }

          return current.filter(
            (item) =>
              item !== day
          );
        }

        return [
          ...current,
          day,
        ].sort(
          (a, b) =>
            a - b
        );
      }
    );
  };

  const save = async () => {
    const pointValue =
      Number(points);

    if (!title.trim()) {
      setError(
        'Chore name is required.'
      );
      return;
    }

    if (!assignees.length && !openToAnyone) { setError('Choose at least one family member or make this chore available.'); return; }

    if (
      !Number.isFinite(
        pointValue
      ) ||
      pointValue < 0
    ) {
      setError(
        'Points must be 0 or greater.'
      );
      return;
    }

    if (
      recurring &&
      recurrenceFrequency ===
        'custom' &&
      selectedWeekdays.length ===
        0
    ) {
      setError(
        'Choose at least one recurring day.'
      );
      return;
    }

    const person = openToAnyone ? null : members.find((item) => item.id === assignees[0]);

    const recurrence =
      recurring
        ? {
            frequency:
              recurrenceFrequency ===
              'custom'
                ? 'weekly'
                : recurrenceFrequency,

            weekdays:
              recurrenceFrequency ===
              'daily'
                ? [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                  ]
                : selectedWeekdays,
          }
        : null;

    const payload = {
      householdId:
        profile.householdId,

      title:
        title.trim(),

      description:
        description.trim(),

      points:
        pointValue,

      // Every chore belongs to the day it is created/assigned.
      assignedDate:
        dateKey(new Date()),

      dueDate: recurring ? null : (dueDate || null),

      assignedTo: openToAnyone ? null : assignees[0],
      assignedToName: openToAnyone ? '' : (person?.name || 'Family member'),
      assignedToRole: openToAnyone ? null : (person?.role || 'child'),
      openToAnyone,

      photoRequired: requiresApproval && photoRequired,

      // OFF by default.
      requiresApproval,

      recurring,

      recurrence,

      createdBy:
        profile.id,
    };

    setSaving(true);
    setError('');

    try {
      if (choreId && occurrenceOnly) {
        await updateChoreOccurrence(choreId, occurrenceDate, payload);
      } else if (choreId) {
        await updateChore(choreId, payload);
      } else if (openToAnyone) {
        await createChore(payload);
      } else {
        // One visible assignment per person keeps completion/points independent when
        // the same chore is assigned to multiple family members.
        await Promise.all(assignees.map((memberId) => {
          const member = members.find((item) => item.id === memberId);
          return createChore({...payload, assignedTo: memberId, assignedToName: member?.name || 'Family member', assignedToRole: member?.role || 'child'});
        }));
      }

      navigation.goBack();
    } catch (err) {
      setError(
        err.message ||
          'Could not save chore.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteOccurrence = () => {
    Alert.alert(
      'Delete this occurrence?',
      `Only the ${dateFromKey(occurrenceDate).toLocaleDateString()} occurrence will be deleted. The recurring chore will continue on its other scheduled days.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete occurrence', style: 'destructive', onPress: async () => {
          setSaving(true);
          setError('');
          try {
            await deleteChoreOccurrence(choreId, occurrenceDate);
            navigation.goBack();
          } catch (err) {
            setError(err.message || 'Could not delete this occurrence.');
          } finally {
            setSaving(false);
          }
        }},
      ]
    );
  };

  const deleteFutureOccurrences = () => {
    Alert.alert(
      'Delete all future occurrences?',
      `This will remove this occurrence and all later occurrences. Earlier history will remain, and the recurring chore will no longer repeat on or after ${dateFromKey(occurrenceDate).toLocaleDateString()}.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete future occurrences', style: 'destructive', onPress: async () => {
          setSaving(true);
          setError('');
          try {
            await deleteFutureChoreOccurrences(choreId, occurrenceDate);
            navigation.goBack();
          } catch (err) {
            setError(err.message || 'Could not delete future occurrences.');
          } finally {
            setSaving(false);
          }
        }},
      ]
    );
  };

  if (loading) {
    return (
      <Screen>
        <LoadingView label="Loading chore form..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>
        {choreId
          ? 'Edit chore'
          : 'Create a chore'}
      </Text>

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      <FormField
        label="Chore name"
        value={title}
        onChangeText={setTitle}
        placeholder="Unload the dishwasher"
      />

      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Add instructions or details."
      />

      <FormField
        label="Points"
        value={points}
        onChangeText={setPoints}
        keyboardType="number-pad"
      />

      <Card>
        <Toggle
          label="Recurring chore"
          value={recurring}
          onChange={(value) => {
            if (value) setDueDate('');
            setRecurring(value);
          }}
        />
        {recurring && <RecurringOptions recurrenceFrequency={recurrenceFrequency} setRecurrenceFrequency={setRecurrenceFrequency} selectedWeekdays={selectedWeekdays} toggleDay={toggleDay} />}
      </Card>

      {!recurring && <Card>
        <View style={styles.group}>
          <Text style={styles.label}>Due date (optional)</Text>
          <Pressable
            onPress={() => setShowDueDatePicker((value) => !value)}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
          >
            <Text style={styles.dateButtonText}>
              {dueDate ? dateFromKey(dueDate).toLocaleDateString() : 'No due date'}
            </Text>
            <View style={styles.dateActions}>
              {!!dueDate && <Pressable onPress={() => setDueDate('')} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.gray500} /></Pressable>}
              <Ionicons name="calendar-outline" size={20} color={colors.rust} />
            </View>
          </Pressable>
          <Text style={styles.helper}>This chore is not considered missed until this date passes.</Text>
          {showDueDatePicker && <DateTimePicker
            value={dateFromKey(dueDate || dateKey(new Date()))}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={(event, selected) => {
              if (Platform.OS !== 'ios') setShowDueDatePicker(false);
              if (selected) {
                setDueDate(dateKey(selected));
                setRecurring(false);
              }
            }}
          />}
        </View>
      </Card>}

      <Card>
        <Text style={styles.cardTitle}>Assignment</Text>
        <View style={styles.assignmentChoice}>
          <Pressable onPress={()=>setOpenToAnyone(false)} style={[styles.assignmentButton,!openToAnyone&&styles.assignmentButtonSelected]}><Text style={[styles.assignmentButtonText,!openToAnyone&&styles.assignmentButtonTextSelected]}>Assign</Text></Pressable>
          <Pressable onPress={()=>setOpenToAnyone(true)} style={[styles.assignmentButton,openToAnyone&&styles.assignmentButtonSelected]}><Text style={[styles.assignmentButtonText,openToAnyone&&styles.assignmentButtonTextSelected]}>Make available</Text></Pressable>
        </View>
        {openToAnyone ? <View style={styles.availableExplanation}><Ionicons name="people-outline" size={19} color={colors.blueDark}/><Text style={styles.availableExplanationText}>Anyone in the family can pick up this chore. Once claimed, it disappears for everyone else.</Text></View> : <View style={styles.people}>
          {members.filter((member) => member.isAvailable !== false || member.id === assignedTo).map((member)=><Pressable key={member.id} onPress={()=>{setAssignees(current=>current.includes(member.id)?current.filter(id=>id!==member.id):[...current,member.id]);setAssignedTo(member.id);}} style={({ pressed })=>[styles.person,assignees.includes(member.id)&&styles.personSelected,pressed&&styles.pressed]}>
            <View style={styles.personAvatar}><Text style={styles.personAvatarText}>{member.name?.charAt(0)?.toUpperCase()||'?'}</Text></View>
            <View style={styles.personCopy}><AdaptiveName style={styles.personName}>{member.name}</AdaptiveName><Text style={styles.personRole}>{member.role==='parent'?'Parent':'Kid'}</Text></View>
            <Ionicons name={assignees.includes(member.id)?'checkmark-circle':'ellipse-outline'} size={21} color={assignees.includes(member.id)?colors.blueDark:colors.gray300}/>
          </Pressable>)}
        </View>}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>
          Chore settings
        </Text>

        <Toggle
          label="Require parent approval"
          value={
            requiresApproval
          }
          onChange={(value) => {
            setRequiresApproval(value);
            if (!value) setPhotoRequired(false);
          }}
        />

        {requiresApproval && <Toggle
          label="Require photo proof"
          value={photoRequired}
          onChange={setPhotoRequired}
        />}

        <Text style={styles.helper}>
          With approval off, points are awarded immediately after completion.
        </Text>
      </Card>

      <PrimaryButton
        title={
          choreId
            ? 'Save changes'
            : 'Create chore'
        }
        onPress={save}
        loading={saving}
      />
      {occurrenceOnly && (
        <>
          <PrimaryButton title="Delete this occurrence" variant="danger" onPress={deleteOccurrence} disabled={saving} />
          <PrimaryButton title="Delete all future occurrences" variant="danger" onPress={deleteFutureOccurrences} disabled={saving} />
        </>
      )}
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
}) {
  return (
    <Pressable
      onPress={() =>
        onChange(!value)
      }
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{
        checked: value,
      }}
    >
      <View
        style={[
          styles.check,
          value &&
            styles.checkOn,
        ]}
      >
        {value && (
          <Text
            style={styles.checkText}
          >
            ✓
          </Text>
        )}
      </View>

      <Text
        style={styles.toggleLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FrequencyButton({
  label,
  selected,
  onPress,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.frequency,
        selected &&
          styles.frequencySelected,
      ]}
    >
      <Text
        style={[
          styles.frequencyText,
          selected &&
            styles.frequencyTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RecurringOptions({recurrenceFrequency, setRecurrenceFrequency, selectedWeekdays, toggleDay}) {
  return (
    <View style={styles.recurringOptions}>
      <Text style={styles.label}>Repeat</Text>
      <View style={styles.frequencyRow}>
        <FrequencyButton label="Every day" selected={recurrenceFrequency === 'daily'} onPress={() => setRecurrenceFrequency('daily')} />
        <FrequencyButton label="Custom" selected={recurrenceFrequency === 'custom'} onPress={() => setRecurrenceFrequency('custom')} />
      </View>
      {recurrenceFrequency === 'custom' && (
        <>
          <Text style={styles.label}>Assign on these days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day) => {
              const selected = selectedWeekdays.includes(day.value);
              return <Pressable key={day.value} onPress={() => toggleDay(day.value)} style={[styles.day, selected && styles.daySelected]}><Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day.label}</Text></Pressable>;
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.charcoal,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
    lineHeight: 19,
  },

  group: {
    gap: 10,
  },

  timeSettingsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  timeSettingsCopy: {
    flex: 1,
    gap: 10,
  },

  recurringToggle: {
    minWidth: 118,
    paddingTop: 2,
  },

  recurringHint: {
    color: colors.gray500,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 17,
  },

  recurringOptions: {
    gap: 10,
    marginTop: 14,
  },

  label: {
    color: colors.charcoal,
    fontSize: 14,
    fontWeight: '700',
  },

  assignmentChoice:{flexDirection:'row',backgroundColor:colors.surfaceMuted,borderRadius:12,padding:3,marginTop:8},
  assignmentButton:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:9},
  assignmentButtonSelected:{backgroundColor:colors.white},
  assignmentButtonText:{fontSize:13,fontWeight:'700',color:colors.gray500},
  assignmentButtonTextSelected:{color:colors.charcoal},
  availableExplanation:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:16,paddingHorizontal:4},
  availableExplanationText:{flex:1,fontSize:13,color:colors.gray600,lineHeight:18},

  dateButton: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  dateButtonText: {
    color: colors.charcoal,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },

  dateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  change: {
    color: colors.rust,
    fontWeight: '800',
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal,
  },

  helper: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray500,
  },

  people: {
    gap: 8,
  },

  person: {
    minHeight: 62,
    borderWidth: 0,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  personSelected: {
    backgroundColor:
      colors.blueSoft,
    borderColor: colors.blue,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor:
      colors.creamSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  personAvatarText: {
    fontWeight: '800',
    color: colors.rustDark,
  },

  personCopy: {
    flex: 1,
    gap: 2,
  },

  personName: {
    color: colors.charcoal,
    fontWeight: '800',
  },

  personRole: {
    color: colors.gray500,
    fontSize: 12,
  },

  toggleRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  check: {
    width: 27,
    height: 27,
    borderWidth: 2,
    borderColor: colors.gray500,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkOn: {
    borderColor: colors.rust,
    backgroundColor: colors.rust,
  },

  checkText: {
    color: colors.white,
    fontWeight: '900',
  },

  toggleLabel: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '600',
  },

  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
  },

  frequency: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },

  frequencySelected: {
    backgroundColor:
      colors.creamSoft,
    borderColor:
      colors.rust,
  },

  frequencyText: {
    color: colors.gray700,
    fontWeight: '700',
  },

  frequencyTextSelected: {
    color: colors.rust,
  },

  daysRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    gap: 6,
  },

  day: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },

  daySelected: {
    backgroundColor:
      colors.blueSoft,
    borderColor:
      colors.blue,
  },

  dayText: {
    fontSize: 12,
    color: colors.gray700,
    fontWeight: '700',
  },

  dayTextSelected: {
    color: colors.blueDark,
  },
});
