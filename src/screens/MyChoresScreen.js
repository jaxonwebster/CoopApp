import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import LoadingView from '../components/LoadingView';
import CelebrationOverlay from '../components/CelebrationOverlay';
import AdaptiveName from '../components/AdaptiveName';
import { useAuth } from '../contexts/AuthContext';
import { claimAvailableChore, choreScheduledOnDate, isMissedChore, isRecurringScheduledOnDate, submitChore, subscribeToHouseholdChores } from '../services/choreService';
import { getFamilyMembers } from '../services/familyService';
import { colors } from '../theme/colors';
import { formatAmericanDateTime } from '../utils/dateFormatters';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseKey(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12, 0, 0, 0); }
function todayKey() { return dateKey(new Date()); }
function choreCoversDate(chore, key) { return choreScheduledOnDate(chore, key); }
function dueLabel(chore) { if (!chore.dueDate || chore.recurring) return ''; return `Due ${parseKey(chore.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`; }
function countsTowardDayProgress(chore, key) { return chore.recurring ? chore.assignedDate === key : chore.dueDate ? chore.dueDate === key : chore.assignedDate === key; }
function canCompleteOnDate(chore, selectedDate) { return !chore.recurring || (selectedDate === todayKey() && chore.assignedDate === todayKey()); }
function monthCells(month) { const first = new Date(month.getFullYear(), month.getMonth(), 1, 12); const start = new Date(first); start.setDate(first.getDate() - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); }

export default function MyChoresScreen({ navigation }) {
  const { profile } = useAuth();
  const [chores, setChores] = useState([]); const [members, setMembers] = useState([]); const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState(''); const [error, setError] = useState('');
  const [parentView, setParentView] = useState('mine'); const [showCompleted, setShowCompleted] = useState(false); const [showSubmitted, setShowSubmitted] = useState(false); const [showAvailable, setShowAvailable] = useState(false); const [celebration, setCelebration] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false); const [selectedDate, setSelectedDate] = useState(todayKey()); const [calendarMonth, setCalendarMonth] = useState(new Date()); const [selectedMembers, setSelectedMembers] = useState([]);

  const load = useCallback(async () => {
    if (!profile?.householdId) return;
    setError('');
    try { const family = await getFamilyMembers(profile.householdId); setMembers(family); }
    catch (err) { setError(err.message || 'Could not load chores.'); }
  }, [profile?.householdId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!profile?.householdId) return undefined;
    setLoading(true);
    return subscribeToHouseholdChores(
      profile.householdId,
      (nextChores) => { setChores(nextChores); setLoading(false); },
      (err) => { setError(err.message || 'Could not listen for chore updates.'); setLoading(false); }
    );
  }, [profile?.householdId]);

  const familyView = profile?.role === 'parent' && parentView === 'family';
  const optionalSeriesIds = new Set(chores.filter((chore) => chore.originallyAvailable === true || chore.claimedFromOptional === true || chore.openToAnyone === true || chore.isAvailable === true || chore.assignmentType === 'available').map((chore) => chore.seriesId || chore.id));
  const isOptionalChore = (chore) => chore.originallyAvailable === true || chore.claimedFromOptional === true || chore.openToAnyone === true || chore.isAvailable === true || chore.assignmentType === 'available' || (chore.recurring && optionalSeriesIds.has(chore.seriesId || chore.id));
  const isUnclaimedOptional = (chore) => isOptionalChore(chore) && !chore.assignedTo;
  const currentSource = familyView ? chores : chores.filter((chore) => chore.assignedTo === profile.id || isUnclaimedOptional(chore));
  const calendarSource = currentSource;
  const filteredCalendarSource = useMemo(() => {
    if (profile?.role !== 'parent' || parentView !== 'family' || !selectedMembers.length) return calendarSource;
    return calendarSource.filter((chore) => selectedMembers.includes(chore.assignedTo));
  }, [calendarSource, parentView, profile?.role, selectedMembers]);
  const recurringSources = useMemo(() => {
    const bySeries = new Map();
    filteredCalendarSource.filter((chore) => chore.recurring).forEach((chore) => {
      const seriesId = chore.seriesId || chore.id;
      const current = bySeries.get(seriesId);
      if (!current || String(chore.assignedDate || '').localeCompare(String(current.assignedDate || '')) < 0) {
        bySeries.set(seriesId, chore);
      }
    });
    return Array.from(bySeries.values());
  }, [filteredCalendarSource]);
  const actualSelectedChores = filteredCalendarSource.filter((chore) => choreCoversDate(chore, selectedDate));
  const actualSeriesForDate = new Set(actualSelectedChores.filter((chore) => chore.recurring).map((chore) => chore.seriesId || chore.id));
  const virtualSelectedChores = recurringSources
    .filter((source) => isRecurringScheduledOnDate(source, selectedDate) && !actualSeriesForDate.has(source.seriesId || source.id))
    .map((source) => ({
      ...source,
      id: `${source.seriesId || source.id}_${selectedDate}`,
      sourceChoreId: source.id,
      assignedDate: selectedDate,
      virtualOccurrence: true,
      status: 'pending',
    }));
  const selectedChores = [...actualSelectedChores, ...virtualSelectedChores];
  const visibleSelectedChores = selectedChores.filter((chore) => !(familyView && isUnclaimedOptional(chore)));
  const active = visibleSelectedChores.filter((chore) => Boolean(chore.assignedTo) && !['completed', 'excused', 'submitted', 'awaitingApproval'].includes(chore.status) && !isUnclaimedOptional(chore));
  const completed = visibleSelectedChores.filter((chore) => chore.status === 'completed');
  const submitted = visibleSelectedChores.filter((chore) => ['submitted', 'awaitingApproval'].includes(chore.status));
  const progressChores = visibleSelectedChores.filter((chore) => countsTowardDayProgress(chore, selectedDate));
  const progressCompleted = progressChores.filter((chore) => chore.status === 'completed');
  const allCompleted = familyView
    ? chores.filter((chore) => chore.status === 'completed' && Boolean(chore.assignedTo) && !isUnclaimedOptional(chore) && choreCoversDate(chore, selectedDate) && (!selectedMembers.length || selectedMembers.includes(chore.assignedTo)))
    : completed;
  const assigneeName = (chore) => chore.assignedToName || members.find((member) => member.id === chore.assignedTo)?.name || 'Family member';
  const hasClaimForDate = (chore) => chores.some((candidate) => candidate.claimedFromOptional === true && candidate.assignedTo && candidate.seriesId === (chore.seriesId || chore.id) && candidate.assignedDate === selectedDate);
  const availableJobs = selectedChores.filter((chore) => isUnclaimedOptional(chore) && !hasClaimForDate(chore) && ['pending', 'available', undefined].includes(chore.status));
  const isToday = selectedDate === todayKey(); const cells = useMemo(() => monthCells(calendarMonth), [calendarMonth]); const memberOptions = members.filter((member) => member.role === 'child' || member.role === 'parent');

  const openChore = (chore) => {
    if (chore.virtualOccurrence && profile.role === 'parent') {
      navigation.navigate('ChoreForm', { choreId: chore.sourceChoreId, occurrenceDate: chore.assignedDate, occurrenceOnly: true });
      return;
    }
    navigation.navigate('ChoreDetail', { choreId: chore.id });
  };

  const claim = async (chore) => {
    setWorkingId(chore.id); setError('');
    try { await claimAvailableChore(chore.virtualOccurrence ? chore.sourceChoreId : chore.id, profile, selectedDate); await load(); }
    catch (err) { setError(err.message || 'Could not pick up this job.'); }
    finally { setWorkingId(''); }
  };

  const checkOff = async (chore) => {
    if (chore.assignedTo !== profile.id || chore.status !== 'pending' || chore.photoRequired || isMissedChore(chore)) { navigation.navigate('ChoreDetail', { choreId: chore.id }); return; }
    setWorkingId(chore.id); setError(''); const before = chores; const optimisticStatus = chore.requiresApproval ? 'awaitingApproval' : 'completed'; LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setChores((items) => items.map((item) => item.id === chore.id ? { ...item, status: optimisticStatus } : item));
    try { await submitChore({ choreId: chore.id, photoUrl: null, requiresApproval: Boolean(chore.requiresApproval) }); await load(); if (!chore.requiresApproval) setCelebration(true); } catch (err) { setChores(before); setError(err.message || 'Could not complete chore.'); } finally { setWorkingId(''); }
  };

  const chooseDate = (date) => { setSelectedDate(dateKey(date)); setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12)); };
  if (loading) return <Screen><LoadingView label="Loading chores..." /></Screen>;

  return <View style={styles.root}><Screen contentStyle={styles.screen}>
    <View style={styles.headerRow}><View><Text style={styles.eyebrow}>CHORES</Text><Text style={styles.heading}>{profile.role === 'parent' ? 'Family chores' : 'My chores'}</Text></View>{profile.role === 'parent' && <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={() => navigation.navigate('ChoreForm')}><Ionicons name="add" size={24} color={colors.white} /></Pressable>}</View>
    {profile.role === 'parent' && <View style={styles.segmented}>{['mine', 'family'].map((value) => <Pressable key={value} onPress={() => setParentView(value)} style={({ pressed }) => [styles.segment, parentView === value && styles.segmentSelected, pressed && styles.pressed]}><Text style={[styles.segmentText, parentView === value && styles.segmentTextSelected]}>{value === 'mine' ? 'Mine' : 'Family'}</Text></Pressable>)}</View>}
    {!!error && <Text style={styles.error}>{error}</Text>}

    <View style={styles.calendarWrap}><Pressable style={({ pressed }) => [styles.calendarHeader, pressed && styles.pressed]} onPress={() => setCalendarOpen((value) => !value)}><View><Text style={styles.calendarLabel}>Schedule</Text><Text style={styles.calendarDate}>{parseKey(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><Ionicons name={calendarOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gray500} /></Pressable>
      {calendarOpen && <View style={styles.calendarCard}><View style={styles.monthHeader}><Pressable onPress={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1, 12))} hitSlop={8}><Ionicons name="chevron-back" size={20} color={colors.charcoal} /></Pressable><Text style={styles.monthTitle}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1, 12))} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={colors.charcoal} /></Pressable></View><View style={styles.weekdayRow}>{DAYS.map((day) => <Text key={day} style={styles.weekday}>{day.slice(0, 2)}</Text>)}</View><View style={styles.calendarGrid}>{cells.map((date) => { const key = dateKey(date); const inMonth = date.getMonth() === calendarMonth.getMonth(); const selected = key === selectedDate; const today = key === todayKey(); const hasChores = filteredCalendarSource.some((chore) => Boolean(chore.assignedTo) && !isOptionalChore(chore) && (chore.recurring ? isRecurringScheduledOnDate(chore, key) : choreCoversDate(chore, key))); return <Pressable key={key} onPress={() => chooseDate(date)} style={({ pressed }) => [styles.dayCell, !inMonth && styles.dayOutside, selected && styles.daySelected, today && styles.dayToday, pressed && styles.pressed]}><Text style={[styles.dayNumber, !inMonth && styles.dayNumberOutside, selected && styles.dayNumberSelected]}>{date.getDate()}</Text>{hasChores && <View style={[styles.dayDot, selected && styles.dayDotSelected]} />}</Pressable>; })}</View></View>}
    </View>
    {!isToday && <Pressable style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]} onPress={() => chooseDate(new Date())}><Ionicons name="today-outline" size={17} color={colors.blueDark} /><Text style={styles.todayButtonText}>View today’s chores</Text></Pressable>}

    {profile.role === 'parent' && parentView === 'family' && <View style={styles.groupBlock}><Text style={styles.groupLabel}>Group by family member</Text><View style={styles.pills}><Pressable onPress={() => setSelectedMembers([])} style={({ pressed }) => [styles.pill, !selectedMembers.length && styles.pillSelected, pressed && styles.pressed]}><Text style={[styles.pillText, !selectedMembers.length && styles.pillTextSelected]}>All</Text></Pressable>{memberOptions.map((member) => <Pressable key={member.id} onPress={() => setSelectedMembers((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} style={({ pressed }) => [styles.pill, selectedMembers.includes(member.id) && styles.pillSelected, pressed && styles.pressed]}><AdaptiveName style={[styles.pillText, selectedMembers.includes(member.id) && styles.pillTextSelected]}>{member.name}</AdaptiveName></Pressable>)}</View></View>}

    <View style={styles.progressLine}><Text style={styles.progressText}>{progressCompleted.length} of {progressChores.length} due today</Text><Text style={styles.pointsHint}>{active.reduce((sum, chore) => sum + Number(chore.points || 0), 0)} pts available</Text></View>
    <View style={styles.list}>{!active.length ? <View style={styles.empty}><Ionicons name={selectedChores.length ? (submitted.length ? 'time-outline' : 'checkmark-circle') : 'calendar-outline'} size={34} color={selectedChores.length ? (submitted.length ? colors.orange : colors.success) : colors.gray400} /><Text style={styles.emptyTitle}>{selectedChores.length ? (submitted.length ? 'Waiting for approval' : 'All done!') : 'No chores scheduled'}</Text><Text style={styles.emptyText}>{selectedChores.length ? (submitted.length ? 'Your submitted chores are listed below.' : 'Nothing else is assigned for this day.') : 'Choose another day to view upcoming chores.'}</Text></View> : active.map((chore) => { const mine = chore.assignedTo === profile.id; const missed = isMissedChore(chore); const scheduledToday = canCompleteOnDate(chore, selectedDate); const tappableCheck = mine && chore.status === 'pending' && !missed && scheduledToday; return <View key={chore.id} style={styles.todoRow}><Pressable disabled={!tappableCheck || workingId === chore.id} onPress={() => checkOff(chore)} style={({ pressed }) => [styles.checkbox, missed && styles.checkboxMissed, !scheduledToday && styles.checkboxLocked, pressed && styles.pressed]}>{workingId === chore.id ? <Text style={styles.checkLoading}>…</Text> : missed ? <Ionicons name="alert" size={17} color={colors.danger} /> : ['submitted', 'awaitingApproval'].includes(chore.status) ? <Ionicons name="time" size={17} color={colors.orange} /> : !scheduledToday ? <Ionicons name="lock-closed-outline" size={15} color={colors.gray500} /> : <Ionicons name="checkmark" size={18} color={colors.white} />}</Pressable><Pressable style={({ pressed }) => [styles.todoCopy, pressed && styles.pressed]} onPress={() => openChore(chore)}><Text style={styles.todoTitle} numberOfLines={1}>{chore.title}</Text><View style={styles.metaRow}>{profile.role === 'parent' && parentView === 'family' && <Text style={styles.meta}>{chore.assignedToName || 'Available'}</Text>}{!!dueLabel(chore) && <Text style={[styles.meta, missed && styles.missedMeta]}>{missed ? 'Missed' : dueLabel(chore)}</Text>}{chore.recurring && !scheduledToday && <Text style={styles.waiting}>Available on scheduled day</Text>}{chore.photoRequired && <Text style={styles.meta}>Photo proof</Text>}{['submitted', 'awaitingApproval'].includes(chore.status) && <Text style={styles.waiting}>Waiting for approval</Text>}</View></Pressable><Text style={styles.points}>+{chore.points || 0}</Text><Pressable onPress={() => openChore(chore)} hitSlop={8}><Ionicons name="chevron-forward" size={18} color={colors.gray300} /></Pressable></View>; })}</View>

    {!familyView && <View style={styles.dropdowns}><View style={styles.dropdownBlock}><Pressable style={({ pressed }) => [styles.completedHeader, pressed && styles.pressed]} onPress={() => setShowAvailable(!showAvailable)}><Text style={styles.completedLabel}>Optional chores · {availableJobs.length}</Text><Ionicons name={showAvailable ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray500} /></Pressable>{showAvailable && (!availableJobs.length ? <Text style={styles.dropdownEmpty}>No optional chores right now.</Text> : availableJobs.map((chore) => <View key={chore.id} style={styles.doneRow}><Text style={[styles.doneText, { textDecorationLine: 'none', color: colors.charcoal }]}>{chore.title}</Text>{profile.role === 'parent' && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${chore.title}`} onPress={() => openChore(chore)} hitSlop={8} style={({ pressed }) => [styles.optionalEditButton, pressed && styles.pressed]}><Ionicons name="create-outline" size={17} color={colors.blueDark} /></Pressable>}<Text style={styles.points}>+{chore.points || 0}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Claim ${chore.title}`} disabled={workingId === chore.id} onPress={() => claim(chore)} style={({ pressed }) => [styles.claimButton, pressed && styles.pressed]}><Text style={styles.claimButtonText}>Claim</Text></Pressable></View>))}</View><View style={styles.dropdownBlock}><Pressable style={({ pressed }) => [styles.completedHeader, pressed && styles.pressed]} onPress={() => setShowSubmitted(!showSubmitted)}><Text style={styles.completedLabel}>Submitted · {submitted.length}</Text><Ionicons name={showSubmitted ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray500} /></Pressable>{showSubmitted && (!submitted.length ? <Text style={styles.dropdownEmpty}>Nothing waiting for parent approval.</Text> : submitted.map((chore) => <Pressable key={chore.id} style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]} onPress={() => openChore(chore)}><Ionicons name="time" size={22} color={colors.orange} /><View style={{ flex: 1 }}><Text style={[styles.doneText, { flex: 0, textDecorationLine: 'none', color: colors.charcoal }]}>{chore.title}</Text><Text style={styles.meta}>Waiting for parent approval</Text></View><Text style={styles.donePoints}>+{chore.points || 0}</Text></Pressable>))}</View><View style={styles.dropdownBlock}><Pressable style={({ pressed }) => [styles.completedHeader, pressed && styles.pressed]} onPress={() => setShowCompleted(!showCompleted)}><Text style={styles.completedLabel}>Completed · {completed.length}</Text><Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray500} /></Pressable>{showCompleted && (!completed.length ? <Text style={styles.dropdownEmpty}>Nothing completed yet.</Text> : completed.map((chore) => <Pressable key={chore.id} style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]} onPress={() => openChore(chore)}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><View style={{ flex: 1 }}><Text style={[styles.doneText, { flex: 0 }]}>{chore.title}</Text><Text style={styles.meta}>{formatAmericanDateTime(chore.completedAt || chore.approvedAt || chore.updatedAt)}</Text></View><Text style={styles.donePoints}>+{chore.points || 0}</Text></Pressable>))}</View></View>}
    {familyView && <View style={styles.dropdowns}><View style={styles.dropdownBlock}><Pressable style={({ pressed }) => [styles.completedHeader, pressed && styles.pressed]} onPress={() => setShowCompleted(!showCompleted)}><Text style={styles.completedLabel}>Completed chores · {allCompleted.length}</Text><Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray500} /></Pressable>{showCompleted && (!allCompleted.length ? <Text style={styles.dropdownEmpty}>No completed chores yet.</Text> : allCompleted.map((chore) => <Pressable key={chore.id} style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]} onPress={() => navigation.navigate('ChoreDetail', { choreId: chore.id })}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><View style={{ flex: 1 }}><Text style={[styles.doneText, { flex: 0 }]}>{chore.title}</Text><Text style={styles.meta}>{assigneeName(chore)} · {formatAmericanDateTime(chore.completedAt || chore.approvedAt || chore.updatedAt)}</Text></View><Text style={styles.donePoints}>+{chore.points || 0}</Text></Pressable>))}</View></View>}
  </Screen><CelebrationOverlay visible={celebration} message="Nice work!" onDone={() => setCelebration(false)} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, screen: { gap: 18 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.rust }, heading: { fontSize: 32, fontWeight: '800', color: colors.charcoal, letterSpacing: -0.8 }, addButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.rust, alignItems: 'center', justifyContent: 'center' }, segmented: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 4 }, segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 }, segmentSelected: { backgroundColor: colors.white }, segmentText: { fontSize: 13, fontWeight: '700', color: colors.gray500 }, segmentTextSelected: { color: colors.charcoal }, calendarWrap: { backgroundColor: colors.surfaceMuted, borderRadius: 16, overflow: 'hidden' }, calendarHeader: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, calendarLabel: { color: colors.rust, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }, calendarDate: { color: colors.charcoal, fontSize: 16, fontWeight: '800', marginTop: 3 }, calendarCard: { backgroundColor: colors.white, padding: 14, borderTopWidth: 1, borderTopColor: colors.gray200 }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, monthTitle: { color: colors.charcoal, fontSize: 15, fontWeight: '800' }, weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, weekday: { width: '14.28%', textAlign: 'center', color: colors.gray500, fontSize: 10, fontWeight: '800' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.28%', height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, dayOutside: { opacity: 0.35 }, daySelected: { backgroundColor: colors.blue }, dayToday: { borderWidth: 1, borderColor: colors.rust }, dayNumber: { color: colors.charcoal, fontSize: 13, fontWeight: '700' }, dayNumberOutside: { color: colors.gray500 }, dayNumberSelected: { color: colors.white }, dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.rust, marginTop: 2 }, dayDotSelected: { backgroundColor: colors.white }, todayButton: { minHeight: 42, borderRadius: 13, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, todayButtonText: { color: colors.blueDark, fontSize: 13, fontWeight: '800' }, daySelected: { backgroundColor: colors.blue }, groupBlock: { gap: 8 }, groupLabel: { color: colors.charcoal, fontSize: 13, fontWeight: '800' }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.surfaceMuted }, pillSelected: { backgroundColor: colors.blue }, pillText: { color: colors.gray700, fontSize: 12, fontWeight: '700' }, pillTextSelected: { color: colors.white }, progressLine: { flexDirection: 'row', justifyContent: 'space-between' }, progressText: { fontSize: 13, fontWeight: '800', color: colors.gray700 }, pointsHint: { fontSize: 12, color: colors.gray500 }, list: { borderTopWidth: 0 }, todoRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12 }, checkbox: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: colors.rust, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, checkboxMissed: { borderColor: colors.danger, backgroundColor: colors.dangerSoft }, checkboxLocked: { borderColor: colors.gray300, backgroundColor: colors.surfaceMuted }, checkLoading: { fontWeight: '900', color: colors.rust }, todoCopy: { flex: 1, paddingVertical: 12 }, todoTitle: { fontSize: 16, fontWeight: '800', color: colors.charcoal }, metaRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }, meta: { fontSize: 11, color: colors.gray500 }, missedMeta: { color: colors.danger, fontWeight: '800' }, waiting: { fontSize: 11, fontWeight: '700', color: colors.orange }, points: { fontSize: 13, fontWeight: '800', color: colors.blueDark }, empty: { alignItems: 'center', paddingVertical: 42, gap: 6 }, emptyTitle: { fontSize: 19, fontWeight: '800', color: colors.charcoal }, emptyText: { fontSize: 13, color: colors.gray500 }, completedHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }, completedLabel: { fontSize: 13, fontWeight: '800', color: colors.gray500 }, doneRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 }, doneText: { flex: 1, color: colors.gray500, textDecorationLine: 'line-through' }, donePoints: { fontSize: 12, fontWeight: '700', color: colors.success }, dropdowns: { gap: 8 }, dropdownBlock: { backgroundColor: colors.surfaceMuted, borderRadius: 16, paddingHorizontal: 14 }, dropdownEmpty: { fontSize: 12, color: colors.gray500, paddingVertical: 14 }, openIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }, optionalEditButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }, claimButton: { minWidth: 62, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.blueDark, alignItems: 'center', justifyContent: 'center' }, claimButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 14 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
