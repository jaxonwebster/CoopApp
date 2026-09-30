import React, {useEffect, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {colors} from '../theme/colors';

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function PrivilegeCountdown({item, style}) {
  const [now, setNow] = useState(Date.now());
  const storedExpiresAt = timestampMillis(item?.privilegeExpiresAt);
  const redeemedAt = timestampMillis(item?.redeemedAt || item?.createdAt);
  const durationHours = Number(item?.privilegeDurationHours || 0);
  const expiresAt = storedExpiresAt || (redeemedAt && durationHours > 0
    ? redeemedAt + durationHours * 60 * 60 * 1000
    : 0);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remaining = expiresAt - now;
  const expired = remaining <= 0;

  return (
    <Text
      style={[styles.countdown, expired && styles.expired, style]}
      accessibilityLabel={expired ? 'Reward expired' : `Reward time left: ${formatRemaining(remaining)}`}
    >
      {expired ? 'Expired' : `Time left: ${formatRemaining(remaining)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  countdown: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  expired: {
    color: colors.charcoal,
  },
});
