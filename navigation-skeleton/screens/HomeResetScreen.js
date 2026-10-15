import React from 'react';
import ScreenStub from './ScreenStub';

export default function HomeResetScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Quick Cleanup"}
      description={"Choose household tasks and people for a Home Reset."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to family", onPress: () => navigation.navigate("Family") }
      ]}
      
    />
  );
}
