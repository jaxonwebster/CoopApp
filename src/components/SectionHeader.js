import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function SectionHeader({
  title,
  caption,
  action,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {title}
        </Text>

        {!!caption && (
          <Text style={styles.caption}>
            {caption}
          </Text>
        )}
      </View>

      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 2,
  },

  copy: {
    flex: 1,
    gap: 3,
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.charcoal,
  },

  caption: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray500,
  },
});
