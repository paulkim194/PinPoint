// Typed AsyncStorage-backed repository for FestivalMap records. Every map's
// landmarks and calibration live nested inside the map record itself (there's
// only ever a handful of maps with a few dozen landmarks each, so we just
// read/mutate/write the whole array rather than modeling separate tables).
//
// Keeping all reads/writes behind this module's functions -- rather than
// calling AsyncStorage directly from screens -- is what lets this swap to
// SQLite later without touching any screen code.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Calibration, FestivalMap, Landmark } from '../types';
import { deleteMapImage } from './imageStorage';

const MAPS_KEY = 'pinpoint:maps:v1';

async function readAll(): Promise<FestivalMap[]> {
  const raw = await AsyncStorage.getItem(MAPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FestivalMap[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(maps: FestivalMap[]): Promise<void> {
  await AsyncStorage.setItem(MAPS_KEY, JSON.stringify(maps));
}

function findOrThrow(maps: FestivalMap[], mapId: string): FestivalMap {
  const map = maps.find((m) => m.id === mapId);
  if (!map) throw new Error(`FestivalMap not found: ${mapId}`);
  return map;
}

export const storage = {
  /** Newest maps first. */
  async getMaps(): Promise<FestivalMap[]> {
    const maps = await readAll();
    return [...maps].sort((a, b) => b.createdAt - a.createdAt);
  },

  async getMap(mapId: string): Promise<FestivalMap | undefined> {
    const maps = await readAll();
    return maps.find((m) => m.id === mapId);
  },

  /** Insert or, if `map.id` already exists, replace it entirely. */
  async saveMap(map: FestivalMap): Promise<void> {
    const maps = await readAll();
    const idx = maps.findIndex((m) => m.id === map.id);
    if (idx >= 0) {
      maps[idx] = map;
    } else {
      maps.push(map);
    }
    await writeAll(maps);
  },

  async deleteMap(mapId: string): Promise<void> {
    const maps = await readAll();
    const map = maps.find((m) => m.id === mapId);
    if (map) deleteMapImage(map.imageUri);
    await writeAll(maps.filter((m) => m.id !== mapId));
  },

  async addLandmark(mapId: string, landmark: Landmark): Promise<FestivalMap> {
    const maps = await readAll();
    const map = findOrThrow(maps, mapId);
    map.landmarks.push(landmark);
    await writeAll(maps);
    return map;
  },

  async updateLandmark(
    mapId: string,
    landmarkId: string,
    patch: Partial<Omit<Landmark, 'id'>>
  ): Promise<FestivalMap> {
    const maps = await readAll();
    const map = findOrThrow(maps, mapId);
    const landmark = map.landmarks.find((l) => l.id === landmarkId);
    if (!landmark) throw new Error(`Landmark not found: ${landmarkId}`);
    Object.assign(landmark, patch);
    await writeAll(maps);
    return map;
  },

  async deleteLandmark(mapId: string, landmarkId: string): Promise<FestivalMap> {
    const maps = await readAll();
    const map = findOrThrow(maps, mapId);
    map.landmarks = map.landmarks.filter((l) => l.id !== landmarkId);
    await writeAll(maps);
    return map;
  },

  async setCalibration(mapId: string, calibration: Calibration | null): Promise<FestivalMap> {
    const maps = await readAll();
    const map = findOrThrow(maps, mapId);
    map.calibration = calibration;
    await writeAll(maps);
    return map;
  },
};
