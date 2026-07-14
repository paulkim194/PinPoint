import { Pressable, StyleSheet, Text, View } from 'react-native';

interface NavigationBannerProps {
  landmarkName: string;
  distanceM: number | null;
  bearingDeg: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  onStop: () => void;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

export default function NavigationBanner({
  landmarkName,
  distanceM,
  bearingDeg,
  headingDeg,
  accuracyM,
  onStop,
}: NavigationBannerProps) {
  // Rotation is relative to which way the phone is currently facing, not
  // absolute compass bearing -- so "pointing straight up" always means
  // "straight ahead of you", regardless of which direction you're facing.
  const relativeRotation = bearingDeg !== null ? bearingDeg - (headingDeg ?? 0) : 0;

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Text style={[styles.arrow, { transform: [{ rotate: `${relativeRotation}deg` }] }]}>↑</Text>
        <View style={styles.textCol}>
          <Text style={styles.label} numberOfLines={1}>
            {landmarkName}
          </Text>
          <Text style={styles.distance}>{distanceM !== null ? formatDistance(distanceM) : 'locating…'}</Text>
        </View>
        <Pressable onPress={onStop} hitSlop={10} style={styles.stopButton}>
          <Text style={styles.stopText}>✕</Text>
        </Pressable>
      </View>
      {accuracyM !== null && <Text style={styles.accuracyNote}>±{Math.round(accuracyM)}m GPS accuracy</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(23,26,33,0.97)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262a35',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: { fontSize: 28, color: '#3b82f6', width: 36, textAlign: 'center' },
  textCol: { flex: 1, marginLeft: 8 },
  label: { color: '#e5e7eb', fontSize: 15, fontWeight: '700' },
  distance: { color: '#8b92a3', fontSize: 13, marginTop: 1 },
  stopButton: { paddingHorizontal: 8, paddingVertical: 4 },
  stopText: { color: '#8b92a3', fontSize: 16 },
  accuracyNote: { color: '#5b6472', fontSize: 11, marginTop: 6, textAlign: 'right' },
});
