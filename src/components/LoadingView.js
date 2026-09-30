import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function LoadingView({label='Loading...'}) {
  return <View style={styles.wrap}><ActivityIndicator size="large" color={colors.rust}/>{!!label&&<Text style={styles.text}>{label}</Text>}</View>;
}
const styles=StyleSheet.create({wrap:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:10},text:{color:colors.gray500,fontSize:12,fontWeight:'600'}});
