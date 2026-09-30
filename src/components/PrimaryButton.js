import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { colors } from '../theme/colors';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
  style,
}) {
  const inactive = disabled || loading;

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? colors.white
      : colors.charcoal;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        styles[variant],
        style,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: textColor },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  compact: {
    minHeight: 46,
    paddingHorizontal: 18,
  },

  primary: {
  backgroundColor: colors.blue,
},

  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  tertiary: {
    backgroundColor: colors.surfaceMuted,
  },

  ghost: {
    backgroundColor: colors.blueSoft,
  },

  danger: {
    backgroundColor: colors.danger,
  },

  text: {
    fontSize: 15,
    fontWeight: '800',
  },

  disabled: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.84,
  },
});
