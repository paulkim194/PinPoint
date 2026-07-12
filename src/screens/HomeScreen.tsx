import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { storage } from '../services/storage';
import type { FestivalMap } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [maps, setMaps] = useState<FestivalMap[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload every time the screen regains focus (e.g. after saving a new map,
  // or coming back from MapView after adding/deleting landmarks).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const loaded = await storage.getMaps();
        if (!cancelled) {
          setMaps(loaded);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const confirmDelete = (map: FestivalMap) => {
    Alert.alert('Delete map?', `"${map.name}" and all its landmarks will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await storage.deleteMap(map.id);
          setMaps((prev) => prev.filter((m) => m.id !== map.id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : maps.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No maps yet</Text>
          <Text style={styles.emptyBody}>
            Tap the + button to photograph or import your first festival map.
          </Text>
        </View>
      ) : (
        <FlatList
          data={maps}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate('MapView', { mapId: item.id })}
              onLongPress={() => confirmDelete(item)}
            >
              <Image source={{ uri: item.imageUri }} style={styles.thumb} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {item.landmarks.length} landmark{item.landmarks.length === 1 ? '' : 's'}
                  {item.calibration ? ' · Calibrated' : ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('Capture')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#e5e7eb', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyBody: { color: '#8b92a3', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171a21',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262a35',
  },
  rowPressed: { opacity: 0.7 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#262a35' },
  rowText: { marginLeft: 12, flex: 1 },
  rowTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: '#8b92a3', fontSize: 13, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 30, lineHeight: 32, marginTop: -2 },
});
