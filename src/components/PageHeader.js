import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import AdaptiveName from './AdaptiveName';

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textWrap}>
          {!!eyebrow && (
            <Text style={styles.eyebrow}>
              {eyebrow}
            </Text>
          )}

          <AdaptiveName style={styles.title}>
            {title}
          </AdaptiveName>

          {!!subtitle && (
            <Text style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>

        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 2,
    zIndex: 30,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },

  textWrap: {
    flex: 1,
    gap: 6,
  },

  eyebrow: {
    color: colors.rust,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  title: {
    color: colors.charcoal,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  subtitle: {
    color: colors.gray700,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
});
