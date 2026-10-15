import React from 'react';
import ScreenStub from './ScreenStub';

export default function ChoreFormScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Create or Edit Chore"}
      description={"Parents can add a chore, assign it, and choose points or proof requirements."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Save and return to chores", onPress: () => navigation.navigate("MyChores") }
      ]}
      
    />
  );
}
