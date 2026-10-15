import React from 'react';
import ScreenStub from './ScreenStub';

export default function RewardFormScreen({ navigation, route }) {
  return (
    <ScreenStub
      title={"Create or Edit Reward"}
      description={"Parents can set a reward name, point cost, and who can redeem it."}
      navigation={navigation}
      route={{route}}
      actions={[
        { label: "Return to rewards", onPress: () => navigation.navigate("Rewards") }
      ]}
      
    />
  );
}
