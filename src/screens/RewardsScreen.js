import React, { useCallback, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import LoadingView from '../components/LoadingView';
import CelebrationOverlay from '../components/CelebrationOverlay';
import PrivilegeCountdown from '../components/PrivilegeCountdown';
import { useAuth } from '../contexts/AuthContext';
import { contributeToFamilyReward, deleteReward, getHouseholdRedemptions, getRewards, getUserRedemptions, isPrivilegeActive, isRewardAvailableToday, requestReward } from '../services/rewardService';
import { colors } from '../theme/colors';
import { formatAmericanDateTime, formatAmericanDate } from '../utils/dateFormatters';

function localTodayKey() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function displayDate(value) { return formatAmericanDate(value) || value || ''; }
function displayStamp(item) { return formatAmericanDateTime(item.reviewedAt || item.createdAt) || displayDate(item.redeemedDate); }
function rewardExpirationText(reward) {
  const hours = Number(reward?.privilegeDurationHours || 0);
  if (!Number.isFinite(hours) || hours <= 0) return '';
  const label = hours % 168 === 0
    ? `${hours / 168} ${hours / 168 === 1 ? 'week' : 'weeks'}`
    : hours % 24 === 0
      ? `${hours / 24} ${hours / 24 === 1 ? 'day' : 'days'}`
      : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `Expires ${label} after claiming`;
}

function rewardScheduleText(reward) {
  if (reward?.isFamilyReward || reward?.type === 'family') return 'Family goal';
  if (reward?.recurring && reward.recurrence?.frequency === 'weekly') return 'Available on selected recurring days';
  if (reward?.dailyPrivilege || reward?.limitPerDay) return 'Available once per day';
  return 'One-time reward';
}

function rewardAudienceText(reward) {
  if (reward?.isFamilyReward || reward?.type === 'family') return 'Everyone can contribute points';
  if (reward?.availability === 'specific') {
    const names = reward.assignedToNames?.length ? reward.assignedToNames : (reward.assignedToName ? [reward.assignedToName] : []);
    return names.length ? `Assigned to ${names.join(', ')}` : 'Specific family members';
  }
  if (reward?.availability === 'first') return 'Available to the first family member who redeems it';
  return 'Available to everyone';
}

const rewardTipsStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(35,31,28,0.38)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 500, maxHeight: '88%', backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 17, shadowColor: colors.charcoal, shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.charcoal, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.gray500, fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: colors.charcoal },
  body: { fontSize: 12, lineHeight: 18, color: colors.gray700, marginTop: 2 },
  detailDescription: { color: colors.gray700, fontSize: 14, lineHeight: 21 },
  detailList: { borderTopWidth: 1, borderTopColor: colors.gray200 },
  detailRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  detailLabel: { color: colors.gray500, fontSize: 12, fontWeight: '700' },
  detailValue: { flex: 1, textAlign: 'right', color: colors.charcoal, fontSize: 12, fontWeight: '800' },
});

export default function RewardsScreen({ navigation }) {
  const { profile, refreshProfile } = useAuth();
  const [rewards,setRewards]=useState([]); const [allRedemptions,setAllRedemptions]=useState([]); const [mine,setMine]=useState([]);
  const [loading,setLoading]=useState(true); const [workingId,setWorkingId]=useState(''); const [error,setError]=useState('');
  const [amounts,setAmounts]=useState({}); const [celebration,setCelebration]=useState(''); const [showHistory,setShowHistory]=useState(false); const [selectedReward,setSelectedReward]=useState(null);

  const load=useCallback(async()=>{ if(!profile?.householdId||!profile?.id)return; setLoading(true); setError(''); try { const [r,a,m]=await Promise.all([getRewards(profile.householdId),getHouseholdRedemptions(profile.householdId),getUserRedemptions(profile.householdId,profile.id)]); setRewards(r);setAllRedemptions(a);setMine(m);await refreshProfile(); } catch(e){setError(e.message||'Could not load rewards.');} finally{setLoading(false);} },[profile?.householdId,profile?.id,refreshProfile]);
  useFocusEffect(useCallback(()=>{load();},[load]));

  const claimedRewardIds=new Set(allRedemptions.filter(x=>x.status!=='rejected').map(x=>x.rewardId));
  const claimed=(id)=>allRedemptions.some(x=>x.rewardId===id&&x.status!=='rejected');
  const usedToday=(id)=>mine.some(x=>x.rewardId===id&&x.redeemedDate===localTodayKey()&&x.status!=='rejected');
  // Parents always see every reward definition so they can manage/edit it, even
  // when that reward has already been claimed. Kids only see rewards currently
  // available to them.
  const rewardAssignedToUser = (reward, userId) => Array.isArray(reward.assignedToIds) ? reward.assignedToIds.includes(userId) : reward.assignedTo === userId;
  const individual=rewards.filter((r)=>{
    if (r.isFamilyReward || r.type === 'family') return false;
    if (profile?.role !== 'parent' && r.availability === 'specific' && !rewardAssignedToUser(r, profile.id)) return false;
    if (profile?.role !== 'parent' && !isRewardAvailableToday(r)) return false;
    if (profile?.role === 'parent') return true;
    if (r.availability === 'first' && claimedRewardIds.has(r.id)) return false;
    if (r.dailyPrivilege || r.limitPerDay) return !usedToday(r.id);
    return !mine.some((item) => item.rewardId === r.id && item.status !== 'rejected');
  }).sort((a,b)=>Number(Boolean(b.dailyPrivilege||b.limitPerDay))-Number(Boolean(a.dailyPrivilege||a.limitPerDay)));
  const family=rewards.filter(r=>r.isFamilyReward||r.type==='family');

  const removeReward=(reward)=>Alert.alert('Delete reward?', `Delete ${reward.name}?`, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{try{await deleteReward(reward.id);await load();}catch(e){setError(e.message||'Could not delete reward.');}}}]);
  const redeem=async(reward)=>{
    if (workingId) return;
    setWorkingId(reward.id);
    setError('');
    try {
      await requestReward({reward,user:profile});
      // Give immediate visual feedback instead of making the user wait for every
      // Firestore refresh before the tap appears to have worked.
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCelebration('Reward redeemed!');
      await load();
    } catch(e) {
      setError(e.message||'Could not redeem this reward.');
    } finally {
      setWorkingId('');
    }
  };
  const contribute=async(reward)=>{const amount=Number(amounts[reward.id]||0);if(!amount){setError('Choose a point amount to contribute.');return;}setWorkingId(reward.id);setError('');try{const result=await contributeToFamilyReward({rewardId:reward.id,amount});await load();setAmounts(v=>({...v,[reward.id]:0}));setCelebration(`+${result?.amount||amount} points added`);}catch(e){console.log('FAMILY CONTRIBUTION ERROR:',e);setError(e?.message||'Could not contribute points.');}finally{setWorkingId('');}};
  const history=useMemo(()=>mine.filter(x=>x.rewardName).slice(0,15),[mine]);
  if(loading)return <Screen><LoadingView label="Loading rewards..."/></Screen>;

  return <View style={styles.root}><Screen contentStyle={styles.screen}>
    <View style={styles.headerRow}><View><Text style={styles.eyebrow}>REWARDS</Text><Text style={styles.heading}>Reward shop</Text></View>{profile?.role==='parent'&&<View style={styles.headerActions}><Pressable style={styles.currentButton} onPress={()=>navigation.navigate('CurrentRewards')} accessibilityLabel="Today's kid rewards"><Ionicons name="receipt-outline" size={21} color={colors.charcoal}/></Pressable><Pressable style={styles.addButton} onPress={()=>navigation.navigate('RewardForm')}><Ionicons name="add" size={24} color={colors.white}/></Pressable></View>}</View>
    <View style={styles.balanceRow}><View style={styles.star}><Ionicons name="star" size={17} color={colors.blueDark}/></View><Text style={styles.balance}>{profile?.points||0}</Text><Text style={styles.balanceLabel}>points available</Text></View>
    {!!error&&<Text style={styles.error}>{error}</Text>}

    <Modal visible={Boolean(selectedReward)} transparent animationType="fade" onRequestClose={() => setSelectedReward(null)}>
      <View style={rewardTipsStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedReward(null)} />
        <View style={rewardTipsStyles.card}>
          <View style={rewardTipsStyles.header}>
            <View style={rewardTipsStyles.icon}><Ionicons name="gift-outline" size={22} color={colors.rust}/></View>
            <View style={{flex: 1}}><Text style={rewardTipsStyles.title}>{selectedReward?.name}</Text><Text style={rewardTipsStyles.subtitle}>{selectedReward ? rewardAudienceText(selectedReward) : ''}</Text></View>
            <Pressable accessibilityLabel="Close reward details" hitSlop={10} onPress={() => setSelectedReward(null)} style={rewardTipsStyles.close}><Ionicons name="close" size={21} color={colors.gray700}/></Pressable>
          </View>
          {!!selectedReward?.description && <Text style={rewardTipsStyles.detailDescription}>{selectedReward.description}</Text>}
          <View style={rewardTipsStyles.detailList}>
            <View style={rewardTipsStyles.detailRow}><Text style={rewardTipsStyles.detailLabel}>{selectedReward?.isFamilyReward ? 'Point goal' : 'Cost'}</Text><Text style={rewardTipsStyles.detailValue}>{selectedReward?.isFamilyReward ? `${selectedReward.goal || selectedReward.cost || 0} points` : `${selectedReward?.cost || 0} points`}</Text></View>
            <View style={rewardTipsStyles.detailRow}><Text style={rewardTipsStyles.detailLabel}>Availability</Text><Text style={rewardTipsStyles.detailValue}>{selectedReward ? rewardScheduleText(selectedReward) : ''}</Text></View>
            {!!selectedReward?.privilegeDurationHours && <View style={rewardTipsStyles.detailRow}><Text style={rewardTipsStyles.detailLabel}>Time limit</Text><Text style={rewardTipsStyles.detailValue}>{rewardExpirationText(selectedReward).replace('Expires ', '')}</Text></View>}
          </View>
        </View>
      </View>
    </Modal>

    <View><Text style={styles.sectionTitle}>All rewards</Text><View style={styles.list}>
      {!individual.length?<Text style={styles.empty}>No rewards are available yet.</Text>:individual.map((reward)=>{const cost=Number(reward.cost||0),points=Number(profile?.points||0),expirationText=rewardExpirationText(reward),activeRedemption=mine.find(x=>x.rewardId===reward.id&&x.status!=='rejected'&&isPrivilegeActive(x));const unavailable=(reward.availability==='first'&&claimed(reward.id))||(reward.dailyPrivilege||reward.limitPerDay?usedToday(reward.id):mine.some(x=>x.rewardId===reward.id&&x.status!=='rejected'));const afford=points>=cost; return <View key={reward.id} style={styles.rewardRow}>
      <Pressable onPress={() => setSelectedReward(reward)} style={({ pressed }) => [styles.copy, pressed && styles.pressed]}><Text style={styles.title}>{reward.name}</Text>{!!(reward.assignedToNames?.length || reward.assignedToName)&&<Text numberOfLines={1} style={styles.meta}>For {(reward.assignedToNames?.length ? reward.assignedToNames : [reward.assignedToName]).join(', ')}</Text>}{!!reward.description&&<Text numberOfLines={1} style={styles.meta}>{reward.description}</Text>}{!!expirationText&&<Text style={[styles.meta,styles.expiration]}>{expirationText}</Text>}{!!activeRedemption&&<PrivilegeCountdown item={activeRedemption}/>}</Pressable>{profile?.role==='parent'&&<View style={styles.manage}><Pressable onPress={()=>navigation.navigate('RewardForm',{rewardId:reward.id})}><Ionicons name="pencil-outline" size={17} color={colors.gray500}/></Pressable><Pressable onPress={()=>removeReward(reward)}><Ionicons name="trash-outline" size={17} color={colors.danger}/></Pressable></View>}<View style={styles.right}><Text style={styles.cost}>{cost} pts</Text>{(() => { const canRedeem = profile?.role !== 'parent' || reward.availability !== 'specific' || rewardAssignedToUser(reward, profile.id); return canRedeem ? <Pressable hitSlop={8} disabled={unavailable||!afford||!!workingId} onPress={()=>redeem(reward)} style={({ pressed })=>[styles.smallButton,(unavailable||!afford||!!workingId)&&styles.disabled,pressed&&styles.pressed]}><Text style={styles.smallButtonText}>{workingId===reward.id?'Redeeming…':unavailable?(reward.dailyPrivilege||reward.limitPerDay?'Done today':'Redeemed'):afford?'Redeem':`Need ${cost-points}`}</Text></Pressable> : null; })()}</View>
      </View>})}
    </View></View>

    {!!family.length&&<View><Text style={styles.sectionTitle}>Family goals</Text><View style={styles.list}>{family.map(reward=>{const goal=Number(reward.goal||reward.cost||0),shared=Number(reward.sharedPoints||0),remaining=Math.max(goal-shared,0),amount=Number(amounts[reward.id]||0);return <View key={reward.id} style={styles.familyRow}>
      <View style={styles.familyTop}><Pressable onPress={() => setSelectedReward(reward)} style={({ pressed }) => [styles.copy, pressed && styles.pressed]}><Text style={styles.title}>{reward.name}</Text><Text style={styles.meta}>{shared} of {goal} points · {remaining?`${remaining} to go`:'Unlocked'}</Text></Pressable>{profile?.role==='parent'&&<View style={styles.manage}><Pressable onPress={()=>navigation.navigate('RewardForm',{rewardId:reward.id})}><Ionicons name="pencil-outline" size={17} color={colors.gray500}/></Pressable><Pressable onPress={()=>removeReward(reward)}><Ionicons name="trash-outline" size={17} color={colors.danger}/></Pressable></View>}</View>
      <View style={styles.progress}><View style={[styles.fill,{width:`${Math.min(shared/Math.max(goal,1)*100,100)}%`}]} /></View>
      {remaining>0?<View style={styles.contributeRow}><TextInput value={amount ? String(amount) : ''} onChangeText={(value)=>setAmounts(a=>({...a,[reward.id]:value.replace(/[^0-9]/g,'')}))} placeholder="Points" placeholderTextColor={colors.gray500} keyboardType="number-pad" style={styles.amountInput}/><Pressable disabled={!amount||Number(amount)>Number(profile?.points||0)||workingId===reward.id} onPress={()=>contribute(reward)} style={[styles.contribute,!amount&&styles.disabled]}><Text style={styles.contributeText}>{workingId===reward.id?'Adding…':'Contribute'}</Text></Pressable></View>:<View style={styles.unlocked}><Text style={styles.unlockedText}>Family goal unlocked</Text></View>}
    </View>})}</View></View>}

    {!!history.length&&<View><Pressable style={({ pressed })=>[styles.historyHeader,pressed&&styles.pressed]} onPress={()=>setShowHistory(v=>!v)}><Text style={styles.sectionTitle}>My reward history · {history.length}</Text><Text style={styles.historyToggle}>{showHistory?'Hide':'Show'}</Text></Pressable>{showHistory&&<View style={styles.list}>{history.map(item=><View key={item.id} style={styles.historyRow}><View style={styles.copy}><Text style={styles.title}>{item.rewardName}</Text><Text style={styles.meta}>{displayStamp(item)}</Text></View><Text style={styles.status}>{item.status}</Text></View>)}</View>}</View>}
  </Screen><CelebrationOverlay visible={!!celebration} message={celebration} onDone={()=>setCelebration('')}/></View>;
}

const styles=StyleSheet.create({
 root:{flex:1},screen:{gap:20},headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.6,color:colors.rust},heading:{fontSize:32,fontWeight:'800',color:colors.charcoal,letterSpacing:-.8},headerActions:{flexDirection:'row',gap:8},currentButton:{width:46,height:46,borderRadius:23,backgroundColor:colors.surfaceMuted,alignItems:'center',justifyContent:'center'},addButton:{width:46,height:46,borderRadius:23,backgroundColor:colors.rust,alignItems:'center',justifyContent:'center'},
 balanceRow:{flexDirection:'row',alignItems:'center',gap:8},star:{width:32,height:32,borderRadius:16,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},balance:{fontSize:24,fontWeight:'800',color:colors.charcoal},balanceLabel:{fontSize:13,color:colors.gray500},sectionTitle:{fontSize:15,fontWeight:'800',color:colors.charcoal,marginBottom:8},sectionHint:{fontSize:11,color:colors.gray500,marginBottom:4},otherHeader:{paddingTop:22,paddingBottom:4,backgroundColor:colors.white},list:{borderTopWidth:0},rewardRow:{minHeight:94,flexDirection:'row',alignItems:'flex-start',gap:12,borderWidth:1,borderColor:colors.gray200,borderRadius:17,backgroundColor:colors.white,padding:15,marginBottom:10,shadowColor:colors.charcoal,shadowOpacity:.05,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:1},copy:{flex:1},title:{fontSize:16,fontWeight:'800',color:colors.charcoal},meta:{fontSize:11,color:colors.gray500,marginTop:4},expiration:{color:colors.charcoal,fontWeight:'700'},manage:{flexDirection:'row',gap:10,alignItems:'center',paddingTop:2},right:{alignItems:'flex-end',gap:8},cost:{fontSize:12,fontWeight:'800',color:colors.blueDark},smallButton:{minWidth:88,minHeight:42,paddingHorizontal:14,paddingVertical:10,borderRadius:12,backgroundColor:colors.charcoal,alignItems:'center',justifyContent:'center'},smallButtonText:{fontSize:12,fontWeight:'800',color:colors.white},disabled:{opacity:.38},pressed:{opacity:.78,transform:[{scale:.98}]},
 familyRow:{padding:15,borderWidth:1,borderColor:colors.gray200,borderRadius:17,backgroundColor:colors.white,marginBottom:10,gap:11,shadowColor:colors.charcoal,shadowOpacity:.05,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:1},familyTop:{flexDirection:'row',alignItems:'flex-start',gap:11},progress:{height:7,borderRadius:99,backgroundColor:colors.gray200,overflow:'hidden'},fill:{height:'100%',borderRadius:99,backgroundColor:colors.blue},contributeRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},amountInput:{height:38,flex:1,minWidth:80,paddingHorizontal:12,borderRadius:11,borderWidth:1,borderColor:colors.gray200,color:colors.charcoal,backgroundColor:colors.surfaceMuted},contribute:{height:36,paddingHorizontal:14,borderRadius:11,backgroundColor:colors.blueDark,alignItems:'center',justifyContent:'center'},contributeText:{fontSize:12,fontWeight:'800',color:colors.white},unlocked:{paddingVertical:3},unlockedText:{fontSize:12,fontWeight:'700',color:colors.success},historyHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},historyToggle:{fontSize:12,fontWeight:'800',color:colors.blueDark},historyRow:{minHeight:56,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:0,paddingVertical:8},status:{fontSize:10,fontWeight:'800',textTransform:'capitalize',color:colors.gray500},empty:{paddingVertical:24,color:colors.gray500,fontSize:13},error:{color:colors.danger,backgroundColor:colors.dangerSoft,padding:12,borderRadius:14}
});
