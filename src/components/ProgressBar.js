import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export default function ProgressBar({ value = 0 }) {
  const percent = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent * 100) }}>
      <View style={[styles.fill, { width: `${percent * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({ track: { height: 10, borderRadius: 999, backgroundColor: colors.gray200, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.blue, borderRadius: 999 } });
