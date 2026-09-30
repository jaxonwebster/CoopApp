import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import LoadingView from '../components/LoadingView';
import PrivilegeCountdown from '../components/PrivilegeCountdown';
import { useAuth } from '../contexts/AuthContext';
import { getHouseholdRedemptions, isPrivilegeActive, removePrivilege } from '../services/rewardService';
import { colors } from '../theme/colors';
import { formatAmericanDateTime } from '../utils/dateFormatters';

export default function CurrentRewardsScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [showExpired, setShowExpired] = useState(false); const [privilegeClock, setPrivilegeClock] = useState(Date.now());
  useEffect(() => { const interval = setInterval(() => setPrivilegeClock(Date.now()), 1000); return () => clearInterval(interval); }, []);
  const load = useCallback(async () => { try { setLoading(true); setError(''); setItems(await getHouseholdRedemptions(profile.householdId)); } catch (err) { setError(err.message || 'Could not load privileges.'); } finally { setLoading(false); } }, [profile.householdId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const active = useMemo(() => items.filter((item) => item.status === 'approved' && isPrivilegeActive(item)), [items, privilegeClock]);
  const expired = useMemo(() => items.filter((item) => item.status === 'approved' && !isPrivilegeActive(item)), [items, privilegeClock]);
  const remove = (item) => Alert.alert('Remove privilege?', `Remove ${item.rewardName} from ${item.userName}?`, [{text: 'Cancel', style: 'cancel'}, {text: 'Remove', style: 'destructive', onPress: async () => { try { await removePrivilege(item); await load(); } catch (err) { setError(err.message || 'Could not remove privilege.'); } }}]);
  const renderItem = (item, isExpired = false) => <View key={item.id} style={styles.row}><View style={styles.copy}><Text style={styles.title}>{item.rewardName}</Text><Text style={styles.meta}>{item.userName} · {item.cost} pts · {formatAmericanDateTime(item.reviewedAt || item.createdAt)}</Text>{isExpired ? <Text style={styles.expiredText}>Expired</Text> : <PrivilegeCountdown item={item} />}</View><Pressable onPress={() => remove(item)} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable></View>;
  if (loading) return <Screen><LoadingView label="Loading active privileges..." /></Screen>;
  return <Screen contentStyle={styles.screen}><View><Text style={styles.eyebrow}>PARENT VIEW</Text><Text style={styles.heading}>Active privileges</Text><Text style={styles.sub}>Current active privileges</Text></View>{!!error && <Text style={styles.error}>{error}</Text>}<View style={styles.list}>{!active.length ? <View style={styles.empty}><Ionicons name="gift-outline" size={28} color={colors.gray400} /><Text style={styles.emptyTitle}>No active privileges</Text></View> : active.map((item) => renderItem(item))}</View><View style={styles.expiredBlock}><Pressable style={({ pressed }) => [styles.expiredHeader, pressed && styles.pressed]} onPress={() => setShowExpired((value) => !value)}><View><Text style={styles.expiredTitle}>Expired privileges</Text><Text style={styles.sub}>{expired.length} expired privilege{expired.length === 1 ? '' : 's'}</Text></View><Ionicons name={showExpired ? 'chevron-up' : 'chevron-down'} size={19} color={colors.gray500} /></Pressable>{showExpired && <View style={styles.list}>{!expired.length ? <Text style={styles.emptyText}>No expired privileges.</Text> : expired.map((item) => renderItem(item, true))}</View>}</View></Screen>;
}

const styles = StyleSheet.create({screen: {gap: 20}, eyebrow: {fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.rust}, heading: {fontSize: 32, fontWeight: '800', color: colors.charcoal, letterSpacing: -0.7}, sub: {fontSize: 13, color: colors.gray500, marginTop: 4}, list: {borderTopWidth: 0}, row: {minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 0, paddingVertical: 10}, copy: {flex: 1}, title: {fontSize: 15, fontWeight: '800', color: colors.charcoal}, meta: {fontSize: 11, color: colors.gray500, marginTop: 3}, expiredText: {fontSize: 12, color: colors.danger, fontWeight: '800', marginTop: 4}, remove: {padding: 8}, empty: {alignItems: 'center', paddingVertical: 48, gap: 7}, emptyTitle: {fontSize: 15, fontWeight: '700', color: colors.charcoal}, emptyText: {fontSize: 12, color: colors.gray500, paddingVertical: 14}, expiredBlock: {borderRadius: 16, backgroundColor: colors.surfaceMuted, paddingHorizontal: 14}, expiredHeader: {minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, expiredTitle: {fontSize: 15, fontWeight: '800', color: colors.charcoal}, error: {color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12}, pressed: {opacity: 0.78, transform: [{scale: 0.99}]}});
