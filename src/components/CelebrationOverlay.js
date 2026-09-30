import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const CONFETTI_COLORS = [colors.rust, colors.blue, colors.orange, colors.success, '#D85C91', '#7E63C8'];
const PIECES = Array.from({ length: 28 }, (_, index) => ({
  x: Math.cos((index / 28) * Math.PI * 2) * (70 + (index % 4) * 18),
  y: Math.sin((index / 28) * Math.PI * 2) * (70 + (index % 4) * 18),
  rotate: (index % 2 ? 1 : -1) * (240 + (index % 5) * 50),
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  width: index % 3 === 0 ? 7 : 5,
  height: index % 3 === 0 ? 13 : 9,
}));

export default function CelebrationOverlay({ visible, message = 'Nice work!', onDone }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { progress.setValue(0); return undefined; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 850, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onDone?.(); });
    return () => animation.stop();
  }, [visible, progress, onDone]);

  if (!visible) return null;
  return <View pointerEvents="none" style={styles.overlay}>
    {PIECES.map((piece, index) => <Animated.View key={index} style={[styles.piece, { width: piece.width, height: piece.height, backgroundColor: piece.color, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.y] }) }, { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.rotate}deg`] }) }, { scale: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.35, 1.15, 1] }) }] , opacity: progress.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }) }]} />)}
    <Animated.View style={[styles.message, { opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.75, 1.05, 0.96] }) }] }]}><Text style={styles.messageText}>{message}</Text></Animated.View>
  </View>;
}

const styles = StyleSheet.create({overlay: {position: 'absolute', left: 0, right: 0, top: 85, alignItems: 'center', zIndex: 50}, piece: {position: 'absolute', borderRadius: 2}, message: {marginTop: 35, backgroundColor: colors.charcoal, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10}, messageText: {color: colors.white, fontSize: 14, fontWeight: '800'}});
