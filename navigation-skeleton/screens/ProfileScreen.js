import React from 'react';
import ScreenStub from './ScreenStub';

export default function ProfileScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Profile & History"}
      description={"Review points, activity, and account options."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Edit profile", onPress: () => navigation.navigate("ProfileEdit") },
        { label: "Notification settings", onPress: () => navigation.navigate("NotificationSettings") },
        { label: "Privacy information", onPress: () => navigation.navigate("LegalInfo", {"page": "privacy"}) }
      ]}
      
    />
  );
}
