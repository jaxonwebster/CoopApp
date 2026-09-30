import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import LoadingView from '../components/LoadingView';
import AdaptiveName from '../components/AdaptiveName';
import {useAuth} from '../contexts/AuthContext';
import {createReward, getReward, updateReward} from '../services/rewardService';
import {getFamilyMembers} from '../services/familyService';
import {colors} from '../theme/colors';

const EXPIRATION_OPTIONS = [
  {value: 'none', title: 'No expiration', description: 'Keep this privilege active until a parent removes it.'},
  {value: '1', title: '1 hour', description: 'Useful for short privileges, such as extra screen time.'},
  {value: '2', title: '2 hours', description: 'The privilege ends two hours after it is claimed.'},
  {value: '24', title: '24 hours', description: 'The privilege is available for one full day.'},
];
const CUSTOM_EXPIRATION = 'custom';
const DAYS = [{value: 0, label: 'Sun'}, {value: 1, label: 'Mon'}, {value: 2, label: 'Tue'}, {value: 3, label: 'Wed'}, {value: 4, label: 'Thu'}, {value: 5, label: 'Fri'}, {value: 6, label: 'Sat'}];

export default function RewardFormScreen({route, navigation}) {
  const rewardId = route.params?.rewardId;
  const {profile} = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('10');
  const [isFamilyReward, setIsFamilyReward] = useState(false);
  const [availability, setAvailability] = useState('all');
  const [members, setMembers] = useState([]);
  const [assignedToIds, setAssignedToIds] = useState([]);
  const [dailyPrivilege, setDailyPrivilege] = useState(false);
  const [claimFrequency, setClaimFrequency] = useState('once');
  const [selectedWeekdays, setSelectedWeekdays] = useState([new Date().getDay()]);
  const [privilegeDurationHours, setPrivilegeDurationHours] = useState('none');
  const [customDurationHours, setCustomDurationHours] = useState('');
  const [goal, setGoal] = useState('100');
  const [loading, setLoading] = useState(Boolean(rewardId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!rewardId) {
      setLoading(false);
      return;
    }

    try {
      const reward = await getReward(rewardId);
      setName(reward.name || '');
      setDescription(reward.description || '');
      setCost(String(reward.cost || 10));
      setIsFamilyReward(Boolean(reward.isFamilyReward || reward.type === 'family'));
      setAvailability(reward.availability || 'all');
      setAssignedToIds(Array.isArray(reward.assignedToIds) && reward.assignedToIds.length ? reward.assignedToIds : (reward.assignedTo ? [reward.assignedTo] : []));
      const savedFrequency = reward.recurring
        ? (reward.recurrence?.frequency === 'weekly' ? 'custom' : 'daily')
        : (reward.dailyPrivilege || reward.limitPerDay ? 'daily' : 'once');
      setClaimFrequency(savedFrequency);
      setDailyPrivilege(savedFrequency !== 'once');
      if (Array.isArray(reward.recurrence?.weekdays) && reward.recurrence.weekdays.length) setSelectedWeekdays(reward.recurrence.weekdays);
      const savedDuration = reward.privilegeDurationHours ? String(reward.privilegeDurationHours) : 'none';
      const isPresetDuration = EXPIRATION_OPTIONS.some((option) => option.value === savedDuration);
      setPrivilegeDurationHours(isPresetDuration ? savedDuration : CUSTOM_EXPIRATION);
      setCustomDurationHours(isPresetDuration ? '' : savedDuration === 'none' ? '' : savedDuration);
      setGoal(String(reward.goal || reward.cost || 100));
    } catch (err) {
      setError(err.message || 'Could not load reward.');
    } finally {
      setLoading(false);
    }
  }, [rewardId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.householdId) return;
    getFamilyMembers(profile.householdId).then(setMembers).catch(() => {});
  }, [profile?.householdId]);

  const save = async () => {
    if (!name.trim()) {
      setError('Give the reward a name.');
      return;
    }

    const costValue = Number(cost);
    const goalValue = Number(goal);
    const durationValue = privilegeDurationHours === 'none'
      ? null
      : Number(privilegeDurationHours === CUSTOM_EXPIRATION ? customDurationHours : privilegeDurationHours);
    const assignedMembers = members.filter((member) => assignedToIds.includes(member.id));
    const recurring = !isFamilyReward && claimFrequency !== 'once';
    const recurrence = recurring ? {
      frequency: claimFrequency === 'custom' ? 'weekly' : 'daily',
      weekdays: claimFrequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : selectedWeekdays,
    } : null;

    if (!isFamilyReward && (!Number.isFinite(costValue) || costValue <= 0)) {
      setError('Enter a point cost greater than zero.');
      return;
    }
    if (isFamilyReward && (!Number.isFinite(goalValue) || goalValue <= 0)) {
      setError('Enter a family goal greater than zero.');
      return;
    }
    if (!isFamilyReward && availability === 'specific' && !assignedToIds.length) {
      setError('Choose at least one family member who can claim this reward.');
      return;
    }
    if (durationValue !== null && (!Number.isFinite(durationValue) || durationValue <= 0)) {
      setError('Choose a valid privilege time limit.');
      return;
    }

    setSaving(true);
    setError('');
    const data = {
      householdId: profile.householdId,
      name: name.trim(),
      description: description.trim(),
      isFamilyReward,
      type: isFamilyReward ? 'family' : 'individual',
      cost: isFamilyReward ? 0 : costValue,
      goal: isFamilyReward ? goalValue : 0,
      availability: isFamilyReward ? null : availability,
      assignedTo: isFamilyReward || availability !== 'specific' ? null : assignedToIds[0],
      assignedToIds: isFamilyReward || availability !== 'specific' ? [] : assignedToIds,
      assignedToName: isFamilyReward || availability !== 'specific' ? '' : assignedMembers.map((member) => member.name).join(', '),
      assignedToNames: isFamilyReward || availability !== 'specific' ? [] : assignedMembers.map((member) => member.name),
      dailyPrivilege: isFamilyReward ? false : recurring,
      limitPerDay: isFamilyReward ? false : recurring,
      recurring,
      recurrence,
      privilegeDurationHours: isFamilyReward ? null : durationValue,
    };

    try {
      if (rewardId) await updateReward(rewardId, data);
      else await createReward(data);
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not save reward.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen><LoadingView label="Loading reward..." /></Screen>;

  return (
    <Screen>
      <Text style={styles.title}>{rewardId ? 'Edit reward' : 'Create reward'}</Text>
      <Text style={styles.subtitle}>Set up what the reward is, who can claim it, and how long the privilege lasts.</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Card>
        <SectionLabel text="REWARD DETAILS" />
        <Text style={styles.cardTitle}>What are they earning?</Text>
        <FormField label="Reward name" value={name} onChangeText={setName} placeholder="30 minutes of screen time" />
        <FormField label="Description (optional)" value={description} onChangeText={setDescription} multiline placeholder="Add any details or conditions." />
      </Card>

      <Card>
        <SectionLabel text="REWARD TYPE" />
        <Text style={styles.cardTitle}>How will points be used?</Text>
        <View style={styles.optionGroup}>
          <Option
            title="Individual reward"
            description="One family member spends their own points to claim it."
            selected={!isFamilyReward}
            onPress={() => setIsFamilyReward(false)}
          />
          <Option
            title="Family goal"
            description="Siblings contribute points toward one shared reward."
            selected={isFamilyReward}
            onPress={() => setIsFamilyReward(true)}
          />
        </View>
      </Card>

      {!isFamilyReward ? (
        <>
          <Card>
            <SectionLabel text="INDIVIDUAL REWARD RULES" />
            <Text style={styles.cardTitle}>How can it be claimed?</Text>
            <FormField label="Point cost" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder="10" />

            <Text style={styles.fieldLabel}>Who may claim it?</Text>
            <View style={styles.optionGroup}>
              <Option
                title="Any family member"
                description="Each family member can claim this reward for themselves."
                selected={availability === 'all'}
                onPress={() => setAvailability('all')}
              />
              <Option
                title="Specific family member"
                description="Only the selected person can claim this reward."
                selected={availability === 'specific'}
                onPress={() => { setAvailability('specific'); setDailyPrivilege(false); setClaimFrequency('once'); }}
              />
              {availability === 'specific' && (
                <View style={styles.peoplePicker}>
                  {members.map((member) => (
                    <Pressable key={member.id} onPress={() => setAssignedToIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} style={({ pressed }) => [styles.personOption, assignedToIds.includes(member.id) && styles.personOptionSelected, pressed && styles.pressed]}>
                      <View style={styles.personOptionCopy}>
                        <AdaptiveName style={styles.personOptionText}>{member.name}</AdaptiveName>
                        <Text style={styles.personOptionRole}>{member.role === 'parent' ? 'Parent' : 'Child'}</Text>
                      </View>
                      {assignedToIds.includes(member.id) && <Ionicons name="checkmark-circle" size={19} color={colors.blueDark} />}
                    </Pressable>
                  ))}
                </View>
              )}
              <Option
                title="First family member only"
                description="Only the first family member who claims it gets the reward."
                selected={availability === 'first'}
                onPress={() => { setAvailability('first'); setDailyPrivilege(false); }}
              />
            </View>
          </Card>

          {availability !== 'first' && (
            <Card>
              <SectionLabel text="CLAIM FREQUENCY" />
              <Text style={styles.cardTitle}>How often can each family member claim it?</Text>
              <View style={styles.optionGroup}>
                <Option
                  title="One time"
                  description="Once claimed, this family member cannot claim it again."
                  selected={claimFrequency === 'once'}
                  onPress={() => { setDailyPrivilege(false); setClaimFrequency('once'); }}
                />
                <Option
                  title="Every day"
                  description="Each family member can claim it once per day."
                  selected={claimFrequency === 'daily'}
                  onPress={() => {
                    setDailyPrivilege(true);
                    setClaimFrequency('daily');
                    if (privilegeDurationHours === 'none') setPrivilegeDurationHours('24');
                  }}
                />
                <Option
                  title="Custom schedule"
                  description="Choose which days of the week it is available."
                  selected={claimFrequency === 'custom'}
                  onPress={() => { setDailyPrivilege(true); setClaimFrequency('custom'); }}
                />
              </View>
              {claimFrequency === 'custom' && <View style={styles.daysRow}>{DAYS.map((day) => <Pressable key={day.value} onPress={() => setSelectedWeekdays((current) => current.includes(day.value) ? (current.length === 1 ? current : current.filter((value) => value !== day.value)) : [...current, day.value].sort((a, b) => a - b))} style={({ pressed }) => [styles.day, selectedWeekdays.includes(day.value) && styles.daySelected, pressed && styles.pressed]}><Text style={[styles.dayText, selectedWeekdays.includes(day.value) && styles.dayTextSelected]}>{day.label}</Text></Pressable>)}</View>}
            </Card>
          )}

          <Card>
            <SectionLabel text="PRIVILEGE EXPIRATION" />
            <Text style={styles.cardTitle}>When should the privilege disappear?</Text>
            <Text style={styles.helper}>This controls how long the reward stays in the family member’s active privileges after it is claimed.</Text>
            <View style={styles.optionGroup}>
              {EXPIRATION_OPTIONS.map((option) => (
                <Option
                  key={option.value}
                  title={option.title}
                  description={option.value === 'none' && dailyPrivilege
                    ? 'The daily claim rule controls when it becomes available again.'
                    : option.description}
                  selected={privilegeDurationHours === option.value}
                  onPress={() => setPrivilegeDurationHours(option.value)}
                />
              ))}
              <Option
                title="Custom time limit"
                description="Set a specific number of hours for this privilege."
                selected={privilegeDurationHours === CUSTOM_EXPIRATION}
                onPress={() => setPrivilegeDurationHours(CUSTOM_EXPIRATION)}
              />
              {privilegeDurationHours === CUSTOM_EXPIRATION && (
                <FormField
                  label="Time limit in hours"
                  value={customDurationHours}
                  onChangeText={setCustomDurationHours}
                  keyboardType="decimal-pad"
                  placeholder="2.5"
                />
              )}
            </View>
          </Card>
        </>
      ) : (
        <Card>
          <SectionLabel text="FAMILY GOAL" />
          <Text style={styles.cardTitle}>How many points are needed?</Text>
          <Text style={styles.helper}>Everyone contributes their own points toward the same shared goal.</Text>
          <FormField label="Point goal" value={goal} onChangeText={setGoal} keyboardType="number-pad" placeholder="100" />
        </Card>
      )}

      <PrimaryButton title={rewardId ? 'Save changes' : 'Create reward'} onPress={save} loading={saving} />
    </Screen>
  );
}

function SectionLabel({text}) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Option({title, description, selected, onPress}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {color: colors.charcoal, fontSize: 30, lineHeight: 38, fontWeight: '800'},
  subtitle: {color: colors.gray700, fontSize: 16, lineHeight: 22},
  error: {color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 14},
  sectionLabel: {color: colors.rust, fontSize: 11, fontWeight: '800', letterSpacing: 1.5},
  cardTitle: {color: colors.charcoal, fontSize: 18, lineHeight: 23, fontWeight: '800'},
  helper: {color: colors.gray500, fontSize: 13, lineHeight: 19},
  fieldLabel: {color: colors.charcoal, fontSize: 14, fontWeight: '700'},
  optionGroup: {gap: 9},
  option: {borderRadius: 16, backgroundColor: colors.surfaceMuted, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11},
  optionSelected: {backgroundColor: colors.blueSoft},
  optionCopy: {flex: 1, gap: 3},
  optionTitle: {color: colors.charcoal, fontSize: 15, fontWeight: '800'},
  optionDescription: {color: colors.gray500, fontSize: 12, lineHeight: 17},
  radio: {width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.gray400},
  radioSelected: {borderColor: colors.blue, backgroundColor: colors.blue},
  peoplePicker: {gap: 7},
  personOption: {minHeight: 46, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  personOptionSelected: {backgroundColor: colors.blueSoft},
  personOptionCopy: {flex: 1, gap: 2},
  personOptionText: {color: colors.charcoal, fontSize: 14, fontWeight: '700'},
  personOptionRole: {color: colors.gray500, fontSize: 11},
  daysRow: {flexDirection: 'row', gap: 6},
  day: {flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center'},
  daySelected: {backgroundColor: colors.blueSoft},
  dayText: {fontSize: 11, color: colors.gray700, fontWeight: '700'},
  dayTextSelected: {color: colors.blueDark},
  pressed: {opacity: 0.78, transform: [{scale: 0.99}]},
});
