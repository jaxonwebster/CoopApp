import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function EmptyState({ icon = 'checkmark-circle-outline', title, body }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}><Ionicons name={icon} size={24} color={colors.blueDark} /></View>
      <Text style={styles.title}>{title}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18, gap: 8 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: colors.charcoal, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, color: colors.gray700, textAlign: 'center', maxWidth: 360 },
});
