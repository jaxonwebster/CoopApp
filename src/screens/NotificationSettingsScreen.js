import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import Screen from '../components/Screen';
import LoadingView from '../components/LoadingView';
import {useAuth} from '../contexts/AuthContext';
import {updateUserProfile} from '../services/familyService';
import {colors} from '../theme/colors';
import {DEFAULT_NOTIFICATION_PREFERENCES, notificationOptionsForRole} from '../utils/notificationPreferences';

export default function NotificationSettingsScreen() {
  const {profile, refreshProfile} = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const options = useMemo(() => notificationOptionsForRole(profile?.role), [profile?.role]);

  useEffect(() => {
    setPreferences({...DEFAULT_NOTIFICATION_PREFERENCES, ...(profile?.notificationPreferences || {})});
  }, [profile?.notificationPreferences]);

  const toggle = async (key) => {
    if (savingKey) return;
    const next = {...preferences, [key]: !preferences[key]};
    setPreferences(next);
    setSavingKey(key);
    setError('');
    try {
      await updateUserProfile(profile.id, {notificationPreferences: next});
      await refreshProfile();
    } catch (err) {
      setPreferences(preferences);
      setError(err.message || 'Could not update notification settings.');
    } finally {
      setSavingKey('');
    }
  };

  if (!profile) return <Screen><LoadingView label="Loading notification settings..." /></Screen>;

  return (
    <Screen contentStyle={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.subtitle}>Choose which Coop updates you want to receive.</Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        {options.map((option, index) => (
          <View key={option.key} style={[styles.row, index < options.length - 1 && styles.divider]}>
            <View style={styles.copy}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <View style={styles.switchBox}>
              <Switch
                style={styles.switch}
                value={preferences[option.key] !== false}
                onValueChange={() => toggle(option.key)}
                disabled={savingKey === option.key}
                trackColor={{false: colors.gray300, true: colors.blue}}
                thumbColor={colors.white}
              />
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.note}>These settings control Coop notification categories. Your phone’s main notification permission must also remain enabled.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {gap: 18},
  eyebrow: {fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.rust},
  heading: {fontSize: 32, fontWeight: '800', color: colors.charcoal, letterSpacing: -0.7},
  subtitle: {fontSize: 13, color: colors.gray500, marginTop: 5},
  card: {backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: 18, paddingHorizontal: 16},
  row: {minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 14},
  divider: {borderBottomWidth: 1, borderBottomColor: colors.gray200},
  copy: {flex: 1, gap: 3},
  title: {fontSize: 15, fontWeight: '800', color: colors.charcoal},
  description: {fontSize: 12, lineHeight: 17, color: colors.gray500},
  switchBox: {width: 54, height: 36, alignItems: 'center', justifyContent: 'center'},
  switch: {margin: 0},
  note: {fontSize: 12, lineHeight: 18, color: colors.gray500},
  error: {color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 14},
});
