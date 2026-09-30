import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Dimensions,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const ScreenKeyboardContext = React.createContext({
  scrollToFocusedInput: () => {},
});

export default function Screen({
  children,
  scroll = true,
  contentStyle,
  refreshControl,
}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const scrollRef = React.useRef(null);
  const scrollY = React.useRef(0);
  const keyboardHeight = React.useRef(0);

  React.useEffect(() => {
    const updateKeyboardHeight = (event) => {
      keyboardHeight.current = event?.endCoordinates?.height || 0;
    };
    const hideKeyboard = () => {
      keyboardHeight.current = 0;
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', updateKeyboardHeight);
    const frameSubscription = Keyboard.addListener('keyboardDidChangeFrame', updateKeyboardHeight);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', hideKeyboard);

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollToFocusedInput = React.useCallback((inputRef) => {
    if (!scroll || !inputRef?.current || !scrollRef.current) return;

    setTimeout(() => {
      inputRef.current?.measureInWindow((x, y, inputWidth, inputHeight) => {
        const windowHeight = Dimensions.get('window').height;
        const keyboardTop = windowHeight - keyboardHeight.current;
        const visibleHeight = Math.max(220, keyboardTop - 24);
        const inputCenter = y + (inputHeight / 2);
        const desiredCenter = visibleHeight / 2;
        const delta = inputCenter - desiredCenter;

        if (delta > 0 || y < 24) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollY.current + delta),
            animated: true,
          });
        }
      });
    }, 180);
  }, [scroll]);

  const innerStyle = [
    styles.inner,
    isTablet && styles.tablet,
    contentStyle,
  ];

  return (
    <ScreenKeyboardContext.Provider value={{ scrollToFocusedInput }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          {scroll ? (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={innerStyle}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              onScroll={(event) => {
                scrollY.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={innerStyle}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenKeyboardContext.Provider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboard: { flex: 1 },

  inner: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 42,
    gap: 20,
  },

  tablet: {
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 52,
    gap: 28,
  },
});
