import React from 'react';
import ScreenStub from './ScreenStub';

export default function ChoreDetailScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Chore Details"}
      description={"A selected chore and its completion instructions."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Edit this chore", onPress: () => navigation.navigate("ChoreForm", {"choreId": "chore-001"}) }
      ]}
      routeValue={route.params?.choreId}
    />
  );
}
