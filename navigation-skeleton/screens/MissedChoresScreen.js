import React from 'react';
import ScreenStub from './ScreenStub';

export default function MissedChoresScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Missed Chores"}
      description={"Review late or missed family chores."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to chores", onPress: () => navigation.navigate("MyChores") }
      ]}
      
    />
  );
}
