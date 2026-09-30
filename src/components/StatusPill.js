import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const map = {
  pending: { label: 'Pending', bg: colors.blueSoft, fg: colors.charcoal },
  awaitingApproval: { label: 'Awaiting approval', bg: '#F9E4BE', fg: colors.warning },
  completed: { label: 'Completed', bg: '#DCEBDF', fg: colors.success },
};

export default function StatusPill({ status }) {
  const item = map[status] || { label: status || 'Unknown', bg: colors.cream, fg: colors.gray700 };
  return <View style={[styles.pill, { backgroundColor: item.bg }]}><Text style={[styles.text, { color: item.fg }]}>{item.label}</Text></View>;
}

const styles = StyleSheet.create({ pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, text: { fontWeight: '700', fontSize: 12 } });
