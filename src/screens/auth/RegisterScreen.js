import React, {
  useMemo,
  useState,
} from 'react';

import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '../../components/Screen';
import FormField from '../../components/FormField';
import PrimaryButton from '../../components/PrimaryButton';

import {
  useAuth,
} from '../../contexts/AuthContext';

import { colors } from '../../theme/colors';
import {
  getPasswordRuleState,
  isStrongPassword,
  PASSWORD_RULES,
} from '../../utils/passwordRules';

export default function RegisterScreen({
  route,
  navigation,
}) {
  const {
    signUp,
  } = useAuth();

  const role =
    route.params?.role ===
    'child'
      ? 'child'
      : 'parent';

  const mode =
    route.params?.mode ===
    'join'
      ? 'join'
      : 'create';

  const creatingHousehold =
    role === 'parent' &&
    mode === 'create';

  const [name, setName] =
    useState('');

  const [familyName, setFamilyName] =
    useState('');

  const [inviteCode, setInviteCode] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const passwordRuleState =
    getPasswordRuleState(password);

  const title = useMemo(() => {
    if (creatingHousehold) {
      return 'Create your family';
    }

    if (role === 'parent') {
      return 'Join your family';
    }

    return 'Join your family';
  }, [
    creatingHousehold,
    role,
  ]);

  const validate = () => {
    if (!name.trim()) {
      return 'Enter your name.';
    }

    if (
      creatingHousehold &&
      !familyName.trim()
    ) {
      return 'Enter a household name.';
    }

    if (
      !creatingHousehold &&
      inviteCode.trim().length !== 6
    ) {
      return 'Enter the 6-character household code.';
    }

    if (
      !email.trim() ||
      !email.includes('@')
    ) {
      return 'Enter a valid email address.';
    }

    if (!isStrongPassword(password)) {
      return 'Password must be at least 8 characters and include a capital letter, number, and special character.';
    }

    if (
      password !==
      confirmPassword
    ) {
      return 'Passwords do not match.';
    }

    return '';
  };

  const handleRegister =
    async () => {
      const message =
        validate();

      if (message) {
        setError(message);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result =
          await signUp({
            name,
            email,
            password,
            role,
            familyName,
            inviteCode,
            mode,
          });

        if (
          result?.householdCode
        ) {
          setError(
            `Your family has been created. Family code: ${result.householdCode}`
          );

          setTimeout(() => {
            navigation.popToTop();
          }, 2500);
        }
      } catch (err) {
        console.log(
          'REGISTER SCREEN ERROR:',
          err
        );

        const message =
          err?.message ||
          'Could not create your account.';

        if (
          message.includes(
            'email-already-in-use'
          )
        ) {
          setError(
            'That email already has an account. Try signing in instead.'
          );
        } else if (
          message.includes(
            'operation-not-allowed'
          )
        ) {
          setError(
            'Email/password sign-in is not enabled in Firebase Authentication.'
          );
        } else if (
          message.includes(
            'permission-denied'
          ) ||
          message.includes(
            'Missing or insufficient permissions'
          )
        ) {
          setError(
            'Firebase blocked the household setup. Check your Firestore rules.'
          );
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <Screen>
      <Image
        source={require('../../../assets/coop-logo-transparent.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Coop logo"
      />

      <Text
        style={styles.roleLabel}
      >
        {role === 'parent'
          ? 'PARENT ACCOUNT'
          : 'KID ACCOUNT'}
      </Text>

      <Text
        style={styles.title}
      >
        {title}
      </Text>

      <Text
        style={styles.subtitle}
      >
        {creatingHousehold
          ? 'You will create the household and receive a family code to share.'
          : 'Enter the family code from a parent to join the household.'}
      </Text>

      {!!error && (
        <Text
          style={[
            styles.error,
            error.startsWith(
              'Your family has'
            ) &&
              styles.success,
          ]}
        >
          {error}
        </Text>
      )}

      <FormField
        label="First Name"
        value={name}
        onChangeText={setName}
        placeholder="John"
        autoCapitalize="words"
      />

      {creatingHousehold ? (
        <FormField
          label="Household name"
          value={familyName}
          onChangeText={
            setFamilyName
          }
          placeholder="Smith"
          autoCapitalize="words"
        />
      ) : (
        <FormField
          label="Family code"
          value={inviteCode}
          onChangeText={(
            value
          ) =>
            setInviteCode(
              value
                .replace(
                  /[^a-zA-Z0-9]/g,
                  ''
                )
                .toUpperCase()
                .slice(0, 6)
            )
          }
          placeholder="ABC123"
          autoCapitalize="characters"
          maxLength={6}
        />
      )}

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
      />

      <FormField
        label="Password"
        value={password}
        onChangeText={
          setPassword
        }
        secureTextEntry
        placeholder="Create a secure password"
      />

      <View
        style={styles.passwordRules}
        accessibilityLabel="Password requirements"
      >
        <Text style={styles.passwordRulesTitle}>
          Password requirements
        </Text>
        {PASSWORD_RULES.map((rule) => {
          const met = passwordRuleState[rule.key];

          return (
            <Text
              key={rule.key}
              style={[
                styles.passwordRule,
                met && styles.passwordRuleMet,
              ]}
            >
              {met ? '✓' : '○'} {rule.label}
            </Text>
          );
        })}
      </View>

      <FormField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={
          setConfirmPassword
        }
        secureTextEntry
        placeholder="Enter it again"
      />

      <PrimaryButton
        title={
          creatingHousehold
            ? 'Create household'
            : 'Join household'
        }
        onPress={
          handleRegister
        }
        loading={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 118,
    height: 118,
    alignSelf: 'center',
  },

  roleLabel: {
    color: colors.rust,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  title: {
    color: colors.charcoal,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '800',
  },

  subtitle: {
    color: colors.gray700,
    fontSize: 15,
    lineHeight: 22,
  },

  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 13,
    borderRadius: 14,
    lineHeight: 19,
  },

  success: {
    color: colors.success,
    backgroundColor: colors.successSoft,
  },

  passwordRules: {
    gap: 5,
    paddingHorizontal: 3,
    marginTop: -2,
  },

  passwordRulesTitle: {
    color: colors.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },

  passwordRule: {
    color: colors.gray600,
    fontSize: 12,
    lineHeight: 18,
  },

  passwordRuleMet: {
    color: colors.success,
    fontWeight: '700',
  },
});
