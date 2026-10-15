import React from 'react';
import ScreenStub from './ScreenStub';

export default function NotificationSettingsScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Notification Settings"}
      description={"Choose which family reminders to receive."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to profile", onPress: () => navigation.navigate("Profile") }
      ]}
      
    />
  );
}
