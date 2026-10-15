import React from 'react';
import ScreenStub from './ScreenStub';

export default function ProfileEditScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Edit Profile"}
      description={"Update a family member\u2019s profile details."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to profile", onPress: () => navigation.navigate("Profile") }
      ]}
      
    />
  );
}
