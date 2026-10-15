import React from 'react';
import ScreenStub from './ScreenStub';

export default function LoginScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Welcome to Coop"}
      description={"Sign in to your family account."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Create an account", onPress: () => navigation.navigate("ChooseAccountType") }
      ]}
      
    />
  );
}
