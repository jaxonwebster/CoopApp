import 'react-native-gesture-handler';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from './theme/colors';
import LoginScreen from './screens/LoginScreen.js';
import ChooseAccountTypeScreen from './screens/ChooseAccountTypeScreen.js';
import RegisterScreen from './screens/RegisterScreen.js';
import HomeScreen from './screens/HomeScreen.js';
import MyChoresScreen from './screens/MyChoresScreen.js';
import ChoreDetailScreen from './screens/ChoreDetailScreen.js';
import ChoreFormScreen from './screens/ChoreFormScreen.js';
import ApprovalsScreen from './screens/ApprovalsScreen.js';
import MissedChoresScreen from './screens/MissedChoresScreen.js';
import RewardsScreen from './screens/RewardsScreen.js';
import RewardFormScreen from './screens/RewardFormScreen.js';
import CurrentRewardsScreen from './screens/CurrentRewardsScreen.js';
import HomeResetScreen from './screens/HomeResetScreen.js';
import FamilyScreen from './screens/FamilyScreen.js';
import MemberProfileScreen from './screens/MemberProfileScreen.js';
import ProfileScreen from './screens/ProfileScreen.js';
import ProfileEditScreen from './screens/ProfileEditScreen.js';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen.js';
import LegalInfoScreen from './screens/LegalInfoScreen.js';

const Stack = createNativeStackNavigator();
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.creamSoft, card: colors.white, text: colors.charcoal, primary: colors.rust, border: colors.gray300 },
};

export default function App() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.charcoal,
          headerTitleStyle: { fontWeight: '800', color: colors.charcoal },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.creamSoft },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Welcome to Coop" }} />
        <Stack.Screen name="ChooseAccountType" component={ChooseAccountTypeScreen} options={{ title: "Choose Account Type" }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create Your Account" }} />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'Home Dashboard',
            headerRight: () => (
              <Pressable onPress={() => navigation.navigate('ChoreForm')} accessibilityRole="button" accessibilityLabel="Add a chore">
                <Text style={{ color: colors.rust, fontWeight: '800' }}>+ Chore</Text>
              </Pressable>
            ),
          })}
        />
        <Stack.Screen name="MyChores" component={MyChoresScreen} options={{ title: "My Chores" }} />
        <Stack.Screen name="ChoreDetail" component={ChoreDetailScreen} options={{ title: "Chore Details" }} />
        <Stack.Screen name="ChoreForm" component={ChoreFormScreen} options={{ title: "Create or Edit Chore" }} />
        <Stack.Screen name="Approvals" component={ApprovalsScreen} options={{ title: "Chore Approvals" }} />
        <Stack.Screen name="MissedChores" component={MissedChoresScreen} options={{ title: "Missed Chores" }} />
        <Stack.Screen name="Rewards" component={RewardsScreen} options={{ title: "Family Rewards" }} />
        <Stack.Screen name="RewardForm" component={RewardFormScreen} options={{ title: "Create or Edit Reward" }} />
        <Stack.Screen name="CurrentRewards" component={CurrentRewardsScreen} options={{ title: "Active Rewards" }} />
        <Stack.Screen name="HomeReset" component={HomeResetScreen} options={{ title: "Quick Cleanup" }} />
        <Stack.Screen name="Family" component={FamilyScreen} options={{ title: "Family" }} />
        <Stack.Screen name="MemberProfile" component={MemberProfileScreen} options={{ title: "Family Member" }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile & History" }} />
        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: "Edit Profile" }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: "Notification Settings" }} />
        <Stack.Screen name="LegalInfo" component={LegalInfoScreen} options={{ title: "Privacy & Legal" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
