import React, {
  useEffect,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAuth,
} from '../contexts/AuthContext';

import {
  db,
} from '../firebase/config';

import {
  colors,
} from '../theme/colors';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ChooseAccountTypeScreen from '../screens/auth/ChooseAccountTypeScreen';

import HomeScreen from '../screens/HomeScreen';
import MyChoresScreen from '../screens/MyChoresScreen';
import ChoreDetailScreen from '../screens/ChoreDetailScreen';
import ChoreFormScreen from '../screens/ChoreFormScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import MissedChoresScreen from '../screens/MissedChoresScreen';
import RewardsScreen from '../screens/RewardsScreen';
import RewardFormScreen from '../screens/RewardFormScreen';
import CurrentRewardsScreen from '../screens/CurrentRewardsScreen';
import HomeResetScreen from '../screens/HomeResetScreen';
import FamilyScreen from '../screens/FamilyScreen';
import MemberProfileScreen from '../screens/MemberProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import LegalInfoScreen from '../screens/LegalInfoScreen';
import LoadingView from '../components/LoadingView';
import { setAppBadgeCount } from '../services/notificationService';
import { navigationRef } from './navigationRef';

const RootStack =
  createNativeStackNavigator();

const Stack =
  createNativeStackNavigator();

const Tab =
  createBottomTabNavigator();


// ============================================================
// NAVIGATION THEME
// ============================================================

const navigationTheme = {
  ...DefaultTheme,

  colors: {
    ...DefaultTheme.colors,

    background:
      colors.background,

    card:
      colors.background,

    text:
      colors.charcoal,

    primary:
      colors.rust,

    border:
      colors.gray300,
  },
};


// ============================================================
// SHARED STACK OPTIONS
// ============================================================

const stackOptions = {
  headerStyle: {
    backgroundColor:
      colors.background,
  },

  headerTintColor:
    colors.charcoal,

  headerTitleStyle: {
    fontWeight:
      '800',
    color: colors.charcoal,
  },

  headerShadowVisible:
    false,
};


// ============================================================
// AUTH STACK
// ============================================================

function AuthStack() {
  return (
    <RootStack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <RootStack.Screen
        name="Login"
        component={
          LoginScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <RootStack.Screen
        name="ChooseAccountType"
        component={
          ChooseAccountTypeScreen
        }
        options={{
          title:
            'Create account',
        }}
      />

      <RootStack.Screen
        name="Register"
        component={
          RegisterScreen
        }
        options={({
          route,
        }) => ({
          title:
            route.params
              ?.role ===
            'child'
              ? 'Kid account'
              : 'Parent account',
        })}
      />
    </RootStack.Navigator>
  );
}


// ============================================================
// HOME STACK
// ============================================================

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <Stack.Screen
        name="Home"
        component={
          HomeScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <Stack.Screen
        name="ChoreForm"
        component={
          ChoreFormScreen
        }
        options={{
          title:
            'Chore',
        }}
      />

      <Stack.Screen
        name="ChoreDetail"
        component={
          ChoreDetailScreen
        }
        options={{
          title:
            'Chore details',
        }}
      />

      <Stack.Screen
        name="Approvals"
        component={
          ApprovalsScreen
        }
        options={{
          title:
            'Approvals',
        }}
      />

      <Stack.Screen
        name="MissedChores"
        component={
          MissedChoresScreen
        }
        options={{
          title:
            'Missed chores',
        }}
      />

      <Stack.Screen
        name="HomeReset"
        component={
          HomeResetScreen
        }
        options={{
          title:
            'Quick Cleanup',
        }}
      />

      <Stack.Screen
        name="RewardForm"
        component={
          RewardFormScreen
        }
        options={{
          title:
            'Reward',
        }}
      />

      {/* 
       * HomeScreen can now navigate directly to a
       * family member's profile.
       */}
      <Stack.Screen
        name="MemberProfile"
        component={
          MemberProfileScreen
        }
        options={{
          title:
            'Family member',
        }}
      />
    </Stack.Navigator>
  );
}


// ============================================================
// CHORES STACK
// ============================================================

function ChoresStack() {
  return (
    <Stack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <Stack.Screen
        name="Chores"
        component={
          MyChoresScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <Stack.Screen
        name="ChoreDetail"
        component={
          ChoreDetailScreen
        }
        options={{
          title:
            'Chore details',
        }}
      />

      <Stack.Screen
        name="ChoreForm"
        component={
          ChoreFormScreen
        }
        options={{
          title:
            'Chore',
        }}
      />

      <Stack.Screen
        name="Approvals"
        component={
          ApprovalsScreen
        }
        options={{
          title:
            'Approvals',
        }}
      />

      <Stack.Screen
        name="MissedChores"
        component={
          MissedChoresScreen
        }
        options={{
          title:
            'Missed chores',
        }}
      />
    </Stack.Navigator>
  );
}


// ============================================================
// REWARDS STACK
// ============================================================

function RewardsStack() {
  return (
    <Stack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <Stack.Screen
        name="Rewards"
        component={
          RewardsScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <Stack.Screen
        name="RewardForm"
        component={
          RewardFormScreen
        }
        options={{
          title:
            'Reward',
        }}
      />

      <Stack.Screen
        name="CurrentRewards"
        component={CurrentRewardsScreen}
        options={{ title: 'Active privileges' }}
      />
    </Stack.Navigator>
  );
}


// ============================================================
// FAMILY STACK
// ============================================================

function FamilyStack() {
  return (
    <Stack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <Stack.Screen
        name="Family"
        component={
          FamilyScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <Stack.Screen
        name="MemberProfile"
        component={
          MemberProfileScreen
        }
        options={{
          title:
            'Family member',
        }}
      />
    </Stack.Navigator>
  );
}


// ============================================================
// PROFILE STACK
// ============================================================

function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={
        stackOptions
      }
    >
      <Stack.Screen
        name="Profile"
        component={
          ProfileScreen
        }
        options={{
          headerShown:
            false,
        }}
      />

      <Stack.Screen
        name="ProfileEdit"
        component={
          ProfileEditScreen
        }
        options={{
          title:
            'Edit profile',
        }}
      />

      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{title: 'Notifications'}}
      />

      <Stack.Screen
        name="LegalInfo"
        component={LegalInfoScreen}
        options={({ route }) => ({
          title: route.params?.page === 'PrivacyPolicy' ? 'Privacy policy' : route.params?.page === 'TermsOfUse' ? 'Terms of use' : 'FAQs',
        })}
      />
    </Stack.Navigator>
  );
}


// ============================================================
// APP TABS
// ============================================================

function AppTabs({
  pendingApprovalCount,
  activeChoreCount,
  isParent,
}) {
  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }) => ({
        headerShown:
          false,

        tabBarActiveTintColor:
          colors.rust,

        tabBarInactiveTintColor:
          colors.gray500,

        tabBarStyle: {
          backgroundColor:
            colors.surface,

          borderTopWidth: 0,
          height: 76,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 28,
          paddingBottom: 10,
          paddingTop: 9,
          overflow: 'hidden',
          shadowColor: colors.charcoal,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 4,
        },

        tabBarLabelStyle: {
          fontWeight:
            '700',

          fontSize:
            11,
        },

        tabBarIcon: ({
          color,
          size,
        }) => {
          const icons = {
            HomeTab:
              'home-outline',

            ChoresTab:
              'checkbox-outline',

            RewardsTab:
              'gift-outline',

            FamilyTab:
              'people-outline',

            ProfileTab:
              'person-outline',
          };

          return (
            <View>
              <Ionicons
                name={
                  icons[
                    route.name
                  ]
                }
                size={
                  size
                }
                color={
                  color
                }
              />

              {((route.name === 'HomeTab' && isParent && pendingApprovalCount > 0) ||
                (route.name === 'ChoresTab' && activeChoreCount > 0)) && (
                  <View
                    style={
                      styles.tabBadge
                    }
                  >
                    <Text
                      style={
                        styles.tabBadgeText
                      }
                    >
                      {(route.name === 'ChoresTab' ? activeChoreCount : pendingApprovalCount) > 9 ? '9+' : (route.name === 'ChoresTab' ? activeChoreCount : pendingApprovalCount)}
                    </Text>
                  </View>
                )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={
          HomeStack
        }
        options={{
          title:
            'Home',
        }}
      />

      <Tab.Screen
        name="ChoresTab"
        component={
          ChoresStack
        }
        options={{
          title:
            'Chores',
        }}
      />

      <Tab.Screen
        name="RewardsTab"
        component={
          RewardsStack
        }
        options={{
          title:
            'Rewards',
        }}
      />

      <Tab.Screen
        name="FamilyTab"
        component={
          FamilyStack
        }
        options={{
          title:
            'Family',
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={
          ProfileStack
        }
        options={{
          title:
            'Profile',
        }}
      />
    </Tab.Navigator>
  );
}


// ============================================================
// MAIN NAVIGATOR
// ============================================================

export default function AppNavigator() {
  const {
    firebaseUser,
    profile,
    initializing,
    authError,
  } = useAuth();

  const [
    pendingApprovalCount,
    setPendingApprovalCount,
  ] = useState(0);

  const [activeChoreCount, setActiveChoreCount] = useState(0);


  // ==========================================================
  // REAL-TIME APPROVAL COUNT
  // ==========================================================

  useEffect(() => {
    if (
      profile?.role !==
        'parent' ||
      !profile?.householdId
    ) {
      setPendingApprovalCount(
        0
      );

      return undefined;
    }

    const choresQuery =
      query(
        collection(
          db,
          'chores'
        ),
        where(
          'householdId',
          '==',
          profile.householdId
        ),
        where(
          'status',
          '==',
          'awaitingApproval'
        )
      );

    let choreCount =
      0;

    const unsubscribeChores =
      onSnapshot(
        choresQuery,
        (snapshot) => {
          choreCount = snapshot.size;

          setPendingApprovalCount(choreCount);
        },
        (error) => {
          console.log(
            'NAVIGATION CHORE APPROVAL LISTENER ERROR:',
            error
          );
        }
      );

    return () => {
      unsubscribeChores();
    };
  }, [
    profile?.role,
    profile?.householdId,
  ]);


  // Small badge on Chores: today's unfinished work assigned to this user.
  useEffect(() => {
    if (!profile?.householdId || !profile?.id) {
      setActiveChoreCount(0);
      setAppBadgeCount(0);
      return undefined;
    }
    const choresQuery = query(
      collection(db, 'chores'),
      where('householdId', '==', profile.householdId),
      where('assignedTo', '==', profile.id)
    );
    const unsubscribe = onSnapshot(choresQuery, (snapshot) => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const activeCount = snapshot.docs.filter((item) => {
        const chore = item.data();
        const assignedDate = chore.assignedDate || chore.dueDate;
        const dueDate = chore.dueDate || assignedDate;
        return !chore.isTemplate &&
          (!assignedDate || (assignedDate <= today && dueDate >= today)) &&
          !chore.openToAnyone &&
          !['completed', 'excused'].includes(chore.status);
      }).length;
      setActiveChoreCount(activeCount);
      setAppBadgeCount(activeCount);
    }, () => setActiveChoreCount(0));
    return unsubscribe;
  }, [profile?.householdId, profile?.id]);

  // ==========================================================
  // INITIALIZING
  // ==========================================================

  if (
    initializing
  ) {
    return <LoadingView label="Starting Coop..." />;
  }


  // ==========================================================
  // PROFILE STILL LOADING
  // ==========================================================

  if (
    firebaseUser &&
    !profile
  ) {
    return <LoadingView label={authError || "Loading your family..."} />;
  }


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  return (
    <View style={styles.appRoot}>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {firebaseUser && profile ? (
          <AppTabs
            pendingApprovalCount={pendingApprovalCount}
            activeChoreCount={activeChoreCount}
            isParent={profile.role === 'parent'}
          />
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },

  loading: {
    flex: 1,

    alignItems:
      'center',

    justifyContent:
      'center',

    paddingHorizontal:
      30,

    backgroundColor:
      colors.background,
  },

  loadingText: {
    marginTop:
      16,

    color:
      colors.gray700,

    fontSize:
      16,

    fontWeight:
      '600',

    textAlign:
      'center',
  },

  loadingError: {
    marginTop:
      12,

    color:
      colors.danger,

    fontSize:
      14,

    textAlign:
      'center',

    lineHeight:
      20,
  },

  tabBadge: {
    position:
      'absolute',

    top:
      -8,

    right:
      -10,

    minWidth:
      17,

    height:
      17,

    paddingHorizontal:
      3,

    borderRadius:
      9,

    backgroundColor:
      colors.danger,

    alignItems:
      'center',

    justifyContent:
      'center',

    borderWidth:
      2,

    borderColor:
      colors.surface,
  },

  tabBadgeText: {
    color:
      colors.white,

    fontSize:
      8,

    fontWeight:
      '900',
  },
});
