import React from 'react';
import ScreenStub from './ScreenStub';

export default function CurrentRewardsScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Active Rewards"}
      description={"See rewards that have been earned or redeemed."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to rewards", onPress: () => navigation.navigate("Rewards") }
      ]}
      
    />
  );
}
