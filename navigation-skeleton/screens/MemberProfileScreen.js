import React from 'react';
import ScreenStub from './ScreenStub';

export default function MemberProfileScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Family Member"}
      description={"View one family member\u2019s status and points."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to family", onPress: () => navigation.navigate("Family") }
      ]}
      routeValue={route.params?.memberId}
    />
  );
}
