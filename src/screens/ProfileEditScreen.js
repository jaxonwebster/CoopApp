import React, {
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import Screen from '../components/Screen';
import Card from '../components/Card';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  updateUserProfile,
} from '../services/familyService';

import {
  uploadProfilePhoto,
} from '../services/storageService';

import { colors } from '../theme/colors';

export default function ProfileEditScreen({
  navigation,
}) {
  const {
    profile,
    refreshProfile,
    signOut,
  } = useAuth();

  const [name, setName] =
    useState(
      profile?.name || ''
    );

  const [imageUri, setImageUri] =
    useState(
      profile?.profilePhotoUrl ||
        null
    );

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] = useState(false);

  const [error, setError] =
    useState('');

  const choosePhoto =
    async () => {
      setError('');

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        setError(
          'Photo library permission is required.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],
            allowsEditing:
              true,
            aspect: [
              1,
              1,
            ],
            quality: 0.85,
          }
        );

      if (
        !result.canceled
      ) {
        setImageUri(
          result.assets[0]
            .uri
        );
      }
    };

  const save = async () => {
    if (!name.trim()) {
      setError(
        'Your name cannot be empty.'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      let photoUrl =
        profile?.profilePhotoUrl ||
        null;

      if (
        imageUri &&
        imageUri !==
          profile?.profilePhotoUrl
      ) {
        photoUrl =
          await uploadProfilePhoto({
            uri: imageUri,
            userId:
              profile.id,
          });
      }

      await updateUserProfile(
        profile.id,
        {
          name:
            name.trim(),
          profilePhotoUrl:
            photoUrl,
        }
      );

      await refreshProfile();

      navigation.goBack();
    } catch (err) {
      setError(
        err.message ||
          'Could not update your profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert('Delete account?', 'This permanently deletes your Coop profile and sign-in account. This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete account', style: 'destructive', onPress: async () => {
        try {
          setDeleting(true);
          const {httpsCallable} = await import('firebase/functions');
          const {functions} = await import('../firebase/config');
          await httpsCallable(functions, 'deleteMyProfile')();
          await signOut().catch(() => {});
        } catch (err) {
          setError(err?.message || 'Could not delete your account.');
          setDeleting(false);
        }
      }},
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>
        Edit profile
      </Text>

      <Text style={styles.subtitle}>
        Update your name and profile picture.
      </Text>

      {!!error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      <Card>
        <Pressable
          onPress={choosePhoto}
          style={styles.photoRow}
        >
          {imageUri ? (
            <Image
              source={{
                uri: imageUri,
              }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={
                styles.avatarPlaceholder
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {name
                  ?.charAt(
                    0
                  )
                  ?.toUpperCase() ||
                  '?'}
              </Text>
            </View>
          )}

          <View
            style={styles.photoCopy}
          >
            <Text
              style={
                styles.photoTitle
              }
            >
              Profile picture
            </Text>

            <Text
              style={
                styles.photoSubtitle
              }
            >
              Tap to choose a photo
            </Text>
          </View>

          <Text
            style={styles.chevron}
          >
            ›
          </Text>
        </Pressable>
      </Card>

      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Your name"
      />

      <PrimaryButton
        title="Save profile"
        onPress={save}
        loading={saving}
      />

      <View style={styles.deleteSection}>
        <Text style={styles.deleteTitle}>Delete account</Text>
        <Text style={styles.deleteText}>Permanently remove your Coop profile and sign-in account.</Text>
        <PrimaryButton title={deleting ? 'Deleting…' : 'Delete account'} variant="danger" onPress={deleteAccount} loading={deleting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.charcoal,
  },

  subtitle: {
    color: colors.gray700,
    fontSize: 16,
    lineHeight: 22,
  },

  error: {
    color: colors.danger,
    backgroundColor:
      colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
  },

  photoRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
  },

  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor:
      colors.blueSoft,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.blueDark,
  },

  photoCopy: {
    flex: 1,
    gap: 4,
  },

  photoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.charcoal,
  },

  photoSubtitle: {
    color: colors.gray500,
    fontSize: 13,
  },

  chevron: {
    color: colors.gray500,
    fontSize: 28,
  },

  deleteSection: {
    gap: 8,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  deleteTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '800',
  },

  deleteText: {
    color: colors.gray500,
    fontSize: 13,
    lineHeight: 18,
  },
});
