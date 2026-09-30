import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '../../components/Screen';

import { colors } from '../../theme/colors';

export default function ChooseAccountTypeScreen({
  navigation,
}) {
  return (
    <Screen>
      <View
        style={styles.container}
      >
        <Text
          style={styles.eyebrow}
        >
          GET STARTED
        </Text>

        <Text
          style={styles.title}
        >
          How are you joining Coop?
        </Text>

        <Text
          style={styles.subtitle}
        >
          Choose the account type that fits
          your role in the household.
        </Text>

        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate(
              'Register',
              {
                role: 'parent',
                mode: 'create',
              }
            )
          }
        >
          <View
            style={styles.icon}
          >
            <Text
              style={styles.iconText}
            >
              P
            </Text>
          </View>

          <View
            style={styles.cardCopy}
          >
            <Text
              style={styles.cardTitle}
            >
              I'm a parent
            </Text>

            <Text
              style={styles.cardDescription}
            >
              Create a new family household.
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate(
              'Register',
              {
                role: 'parent',
                mode: 'join',
              }
            )
          }
        >
          <View
            style={styles.icon}
          >
            <Text
              style={styles.iconText}
            >
              P
            </Text>
          </View>

          <View
            style={styles.cardCopy}
          >
            <Text
              style={styles.cardTitle}
            >
              I'm a parent joining a family
            </Text>

            <Text
              style={styles.cardDescription}
            >
              Join a household someone else already created.
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate(
              'Register',
              {
                role: 'child',
                mode: 'join',
              }
            )
          }
        >
          <View
            style={styles.icon}
          >
            <Text
              style={styles.iconText}
            >
              K
            </Text>
          </View>

          <View
            style={styles.cardCopy}
          >
            <Text
              style={styles.cardTitle}
            >
              I'm a kid
            </Text>

            <Text
              style={styles.cardDescription}
            >
              Join your family's existing household.
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },

  eyebrow: {
    color: colors.rust,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  title: {
    color: colors.charcoal,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
  },

  subtitle: {
    color: colors.gray700,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 14,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconText: {
    color: colors.blueDark,
    fontWeight: '900',
    fontSize: 18,
  },

  cardCopy: {
    flex: 1,
    gap: 4,
  },

  cardTitle: {
    color: colors.charcoal,
    fontSize: 16,
    fontWeight: '800',
  },

  cardDescription: {
    color: colors.gray500,
    fontSize: 13,
    lineHeight: 18,
  },

  arrow: {
    color: colors.gray500,
    fontSize: 28,
  },
});
