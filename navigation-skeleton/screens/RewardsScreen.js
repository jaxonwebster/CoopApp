import React from 'react';
import ScreenStub from './ScreenStub';

export default function RewardsScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Family Rewards"}
      description={"Explore individual and shared rewards."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Create or edit a reward", onPress: () => navigation.navigate("RewardForm") },
        { label: "View active rewards", onPress: () => navigation.navigate("CurrentRewards") }
      ]}
      
    />
  );
}
