import React from 'react';
import ScreenStub from './ScreenStub';

export default function ChooseAccountTypeScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Choose Account Type"}
      description={"Choose a parent or child account to continue."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Continue to sign up", onPress: () => navigation.navigate("Register", {"accountType": "parent"}) },
        { label: "Back to sign in", onPress: () => navigation.navigate("Login") }
      ]}
      
    />
  );
}
