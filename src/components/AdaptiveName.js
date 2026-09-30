import React, {useEffect, useState} from 'react';
import {StyleSheet, Text} from 'react-native';

// Names are user content, so keep them on one line even on narrow cards.
export default function AdaptiveName({children, style, ...props}) {
  const baseStyle = StyleSheet.flatten(style) || {};
  const baseFontSize = Number(baseStyle.fontSize || 14);
  const [fontScale, setFontScale] = useState(1);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    setFontScale(1);
    setFits(false);
  }, [children, baseFontSize]);

  const onTextLayout = (event) => {
    props.onTextLayout?.(event);
    const lineCount = event.nativeEvent?.lines?.length || 1;
    if (lineCount > 1 && fontScale > 0.68) {
      setFits(false);
      setFontScale((current) => Math.max(0.68, current - 0.08));
    } else if (lineCount <= 1) {
      setFits(true);
    }
  };

  return (
    <Text
      {...props}
      style={[style, {fontSize: baseFontSize * fontScale}]}
      numberOfLines={fits ? 1 : undefined}
      onTextLayout={onTextLayout}
    >
      {children}
    </Text>
  );
}
