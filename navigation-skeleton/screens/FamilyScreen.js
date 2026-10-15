import React from 'react';
import ScreenStub from './ScreenStub';

export default function FamilyScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Family"}
      description={"See household members, points, and availability."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "View Alex\u2019s profile", onPress: () => navigation.navigate("MemberProfile", {"memberId": "member-001"}) },
        { label: "Start a Home Reset", onPress: () => navigation.navigate("HomeReset") }
      ]}
      
    />
  );
}
