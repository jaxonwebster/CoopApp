import React from 'react';
import ScreenStub from './ScreenStub';

export default function HomeScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Home Dashboard"}
      description={"See your family\u2019s progress and jump into a main area."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "My Chores", onPress: () => navigation.navigate("MyChores") },
        { label: "Rewards", onPress: () => navigation.navigate("Rewards") },
        { label: "Family", onPress: () => navigation.navigate("Family") },
        { label: "Profile & History", onPress: () => navigation.navigate("Profile") }
      ]}
      
    />
  );
}
