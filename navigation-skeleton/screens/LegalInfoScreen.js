import React from 'react';
import ScreenStub from './ScreenStub';

export default function LegalInfoScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Privacy & Legal"}
      description={"Read Coop\u2019s privacy policy, terms, and FAQs."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "View terms", onPress: () => navigation.navigate("LegalInfo", {"page": "terms"}) },
        { label: "Return to profile", onPress: () => navigation.navigate("Profile") }
      ]}
      
    />
  );
}
