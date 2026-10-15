import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { colors } from '../theme/colors';

export default function ScreenStub({ title, description, navigation, actions = [], routeValue }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>COOP · NAVIGATION SKELETON</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {routeValue ? <Text style={styles.param}>Route ID: {routeValue}</Text> : null}
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable key={action.label} style={styles.button} onPress={action.onPress}>
            <Text style={styles.buttonText}>{action.label}</Text>
          </Pressable>
        ))}
        {navigation.canGoBack() ? (
          <Pressable style={[styles.button, styles.secondary]} onPress={() => navigation.goBack()}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 22, backgroundColor: colors.creamSoft },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.gray200 },
  eyebrow: { color: colors.rust, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  title: { color: colors.charcoal, fontSize: 26, fontWeight: '800', marginBottom: 10 },
  description: { color: colors.gray700, fontSize: 16, lineHeight: 23 },
  param: { color: colors.blueDark, backgroundColor: colors.blueSoft, borderRadius: 12, padding: 12, marginTop: 16, fontWeight: '700' },
  actions: { gap: 10, paddingTop: 18 },
  button: { backgroundColor: colors.rust, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  buttonText: { color: colors.white, fontWeight: '700', textAlign: 'center', fontSize: 15 },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray300 },
  secondaryText: { color: colors.charcoal },
});
