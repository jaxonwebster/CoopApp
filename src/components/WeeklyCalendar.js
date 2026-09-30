import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {addDays, format, isSameDay, startOfWeek} from 'date-fns';
import {colors} from '../theme/colors';
import {choreScheduledOnDate} from '../services/choreService';

function dateKey(date) { return format(date, 'yyyy-MM-dd'); }
function isOptionalChore(chore, optionalSeriesIds) { return chore.originallyAvailable === true || chore.claimedFromOptional === true || chore.openToAnyone === true || chore.isAvailable === true || chore.assignmentType === 'available' || (chore.recurring && optionalSeriesIds.has(chore.seriesId || chore.id)); }
function getDayStatus({date, chores, userId, lockedDayStatus}) {
  const key = dateKey(date);
  const today = dateKey(new Date());
  if (key < today && typeof lockedDayStatus?.[key] === 'boolean') {
    return lockedDayStatus[key] ? 'complete' : 'missed';
  }
  const optionalSeriesIds = new Set(chores.filter((chore) => chore.originallyAvailable === true || chore.claimedFromOptional === true || chore.openToAnyone === true || chore.isAvailable === true || chore.assignmentType === 'available').map((chore) => chore.seriesId || chore.id));
  let dayChores = chores
    .filter((chore) => Boolean(chore.assignedTo)
      && !isOptionalChore(chore, optionalSeriesIds)
      && (!chore.dueDate || key >= chore.dueDate)
      && choreScheduledOnDate(chore, key)
      && chore.status !== 'excused')
    .map((chore) => chore.recurring && chore.assignedDate !== key ? {...chore, status: 'pending'} : chore);
  if (userId) dayChores = dayChores.filter((chore) => chore.assignedTo === userId);
  if (!dayChores.length) return 'empty';
  const completed = dayChores.filter((chore) => chore.status === 'completed').length;
  const unfinished = dayChores.length - completed;
  if (completed === dayChores.length) return 'complete';
  if (key < dateKey(new Date()) && unfinished > 0) return 'missed';
  if (completed > 0) return 'partial';
  return 'pending';
}

export default function WeeklyCalendar({chores = [], userId, title, subtitle, lockedDayStatus}) {
  const now = new Date();
  const days = useMemo(() => {
    const monday = startOfWeek(now, {weekStartsOn: 1});
    return Array.from({length: 7}, (_, i) => addDays(monday, i));
  }, [now.getFullYear(), now.getMonth(), now.getDate()]);

  return <View style={styles.wrapper}>
    <View style={styles.heading}>
      <Text style={styles.title}>{title || 'This week'}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    <View style={styles.weekRow}>
      {days.map((date) => {
        const isToday = isSameDay(date, now);
        const status = getDayStatus({date, chores, userId, lockedDayStatus});
        return <View key={dateKey(date)} style={styles.day}>
          <Text style={[styles.weekLabel, isToday && styles.todayLabel]}>{isToday ? 'TODAY' : format(date, 'EEE').toUpperCase()}</Text>
          <View style={[styles.circle, styles[`circle_${status}`], isToday && styles.todayCircle]}>
            <Text style={[styles.dayNumber, status === 'complete' && styles.completeText, isToday && styles.todayText]}>{format(date, 'd')}</Text>
          </View>
          <View style={[styles.dot, styles[`dot_${status}`]]}/>
        </View>;
      })}
    </View>
    <View style={styles.legend}><Legend label="Complete" status="complete"/><Legend label="Partial" status="partial"/><Legend label="Missed" status="missed"/></View>
  </View>;
}
function Legend({label,status}) { return <View style={styles.legendItem}><View style={[styles.legendDot,styles[`dot_${status}`]]}/><Text style={styles.legendText}>{label}</Text></View>; }
const styles=StyleSheet.create({wrapper:{gap:14},heading:{gap:3},title:{fontSize:20,fontWeight:'800',color:colors.charcoal},subtitle:{fontSize:13,color:colors.gray500},weekRow:{flexDirection:'row',justifyContent:'space-between'},day:{width:'14.285%',alignItems:'center',gap:5},weekLabel:{fontSize:9,fontWeight:'800',color:colors.gray500},todayLabel:{fontSize:8,color:colors.success},circle:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',borderWidth:0},dayNumber:{fontSize:13,fontWeight:'700',color:colors.gray700},todayCircle:{borderWidth:2,borderColor:colors.success,backgroundColor:colors.white},todayText:{color:colors.success,fontWeight:'900'},circle_complete:{backgroundColor:colors.success},circle_partial:{backgroundColor:colors.warningSoft},circle_missed:{backgroundColor:colors.dangerSoft},circle_pending:{backgroundColor:colors.surfaceMuted},circle_empty:{backgroundColor:'transparent'},completeText:{color:colors.white},dot:{width:5,height:5,borderRadius:3,backgroundColor:'transparent'},dot_complete:{backgroundColor:colors.success},dot_partial:{backgroundColor:colors.orange},dot_missed:{backgroundColor:colors.danger},dot_pending:{backgroundColor:colors.gray300},legend:{flexDirection:'row',gap:14,flexWrap:'wrap'},legendItem:{flexDirection:'row',alignItems:'center',gap:5},legendDot:{width:7,height:7,borderRadius:4},legendText:{fontSize:10,color:colors.gray500}});
