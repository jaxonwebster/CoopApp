import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen';
import FormField from '../../components/FormField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) return setError('Enter both your email and password.');
    setLoading(true);
    setError('');
    try { await signIn(email, password); }
    catch (err) {
      const message = err?.message || 'Could not sign in.';
      setError(message.includes('invalid-credential') ? 'That email or password is incorrect.' : message);
    } finally { setLoading(false); }
  };

  return (
    <Screen contentStyle={styles.content}>
      <Image source={require('../../../assets/coop-logo-transparent.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="Coop logo" />
      <View style={styles.heading}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your household.</Text>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.form}>
        <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      </View>
      <PrimaryButton title="Sign in" onPress={handleLogin} loading={loading} />
      <PrimaryButton title="Create an account" onPress={() => navigation.navigate('ChooseAccountType')} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', maxWidth: 520, paddingBottom: 50, gap: 22 },
  logo: { width: 190, height: 190, alignSelf: 'center', marginBottom: 2 },
  heading: { gap: 4 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: colors.charcoal, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, color: colors.gray700 },
  form: { gap: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 13, borderRadius: 14 },
});
