import React from 'react';
import ScreenStub from './ScreenStub';

export default function ApprovalsScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Chore Approvals"}
      description={"Review chores waiting for parent approval."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Open chores", onPress: () => navigation.navigate("MyChores") }
      ]}
      
    />
  );
}
