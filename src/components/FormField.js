import React, { useId } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { ScreenKeyboardContext } from './Screen';

export default function FormField({
  label,
  helper,
  error,
  multiline = false,
  ...props
}) {
  const reactId = useId();
  const accessoryId = `coop-keyboard-${reactId.replace(/[:]/g, '')}`;
  const inputRef = React.useRef(null);
  const { scrollToFocusedInput } = React.useContext(ScreenKeyboardContext);
  const {
    onFocus,
    onSubmitEditing,
    returnKeyType,
    ...inputProps
  } = props;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.gray500}
        multiline={multiline}
        returnKeyType={multiline ? (returnKeyType || 'default') : (returnKeyType || 'done')}
        blurOnSubmit={multiline ? false : true}
        inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
        onFocus={(event) => {
          scrollToFocusedInput(inputRef);
          onFocus?.(event);
        }}
        onSubmitEditing={(event) => {
          if (!multiline) Keyboard.dismiss();
          onSubmitEditing?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.inputError,
        ]}
        {...inputProps}
      />

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.keyboardBar}>
            <Pressable onPress={Keyboard.dismiss} hitSlop={12} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {!!helper && !error && <Text style={styles.helper}>{helper}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { color: colors.charcoal, fontWeight: '700', fontSize: 14 },
  input: {
    minHeight: 54, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface,
    color: colors.charcoal, fontSize: 16,
  },
  multiline: { minHeight: 120, paddingTop: 15, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  helper: { color: colors.gray500, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  keyboardBar: {
    minHeight: 52, paddingHorizontal: 18, flexDirection: 'row',
    justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray300,
  },
  doneButton: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: colors.blueDark, fontSize: 15, fontWeight: '800' },
});
