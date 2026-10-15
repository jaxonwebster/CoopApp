import React from 'react';
import ScreenStub from './ScreenStub';

export default function RegisterScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Create Your Account"}
      description={"Set up your Coop account."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Finish setup", onPress: () => navigation.navigate("Home") }
      ]}
      
    />
  );
}
