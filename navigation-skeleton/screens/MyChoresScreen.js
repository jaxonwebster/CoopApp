import React from 'react';
import ScreenStub from './ScreenStub';

export default function MyChoresScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"My Chores"}
      description={"Review assigned chores and choose one to view."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "View \u201cFeed the chickens\u201d", onPress: () => navigation.navigate("ChoreDetail", {"choreId": "chore-001"}) },
        { label: "Create or edit a chore", onPress: () => navigation.navigate("ChoreForm") },
        { label: "Parent approvals", onPress: () => navigation.navigate("Approvals") },
        { label: "Missed chores", onPress: () => navigation.navigate("MissedChores") }
      ]}
      
    />
  );
}
