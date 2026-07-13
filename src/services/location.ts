// Thin wrapper over expo-location: permissions + an averaged single-fix
// capture for calibration. (A watch-subscription wrapper for the live blue
// dot gets added here in the next phase.)
import * as Location from 'expo-location';

export interface CapturedFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

export async function requestForegroundPermission(): Promise<boolean> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

export async function hasForegroundPermission(): Promise<boolean> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  return granted;
}

/**
 * Captures a single "clean" GPS fix by averaging several Accuracy.Highest
 * readings taken a beat apart, rather than trusting whichever single sample
 * happens to land first (which can be noisy, especially right after the GPS
 * radio wakes up).
 */
export async function captureAveragedPosition(sampleCount = 4, intervalMs = 500): Promise<CapturedFix> {
  const samples: Location.LocationObject[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    samples.push(position);
    if (i < sampleCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  const lat = samples.reduce((sum, s) => sum + s.coords.latitude, 0) / samples.length;
  const lng = samples.reduce((sum, s) => sum + s.coords.longitude, 0) / samples.length;
  const accuracyM = samples.reduce((sum, s) => sum + (s.coords.accuracy ?? 0), 0) / samples.length;

  return { lat, lng, accuracyM };
}
