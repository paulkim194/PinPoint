// Thin wrapper over expo-location (permissions, averaged single-fix capture
// for calibration, live position watching) and expo-sensors (compass
// heading from the raw magnetometer, for the navigation arrow).
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

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

export interface LiveFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

/**
 * Starts watching live position for the blue dot. Uses Accuracy.Balanced
 * (not Highest) -- this runs continuously while tracking is on, and
 * Balanced is dramatically lighter on battery for a feature meant to stay
 * on for hours at a festival. Returns the subscription; call
 * `.remove()` on it to stop.
 */
export async function watchPosition(onUpdate: (fix: LiveFix) => void): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 },
    (position) => {
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? 0,
      });
    }
  );
}

/**
 * Starts watching device compass heading (degrees, 0-360, clockwise from
 * true... well, magnetic north -- raw magnetometer, no declination
 * correction) from the raw magnetometer x/y. Returns a subscription with
 * `.remove()`.
 *
 * NOTE: this assumes the phone is held roughly flat/facing-forward, the
 * standard simplification used when not doing full tilt compensation via
 * the accelerometer. This is the one piece of Phase 1 math I could not
 * verify without a physical device -- if the arrow consistently points a
 * fixed amount off (e.g. 90 degrees or exactly backwards) rather than
 * jittering randomly, it's a one-line fix in `magnetometerToHeadingDeg`.
 */
export function watchHeading(onUpdate: (headingDeg: number) => void) {
  Magnetometer.setUpdateInterval(500);
  return Magnetometer.addListener(({ x, y }) => {
    onUpdate(magnetometerToHeadingDeg(x, y));
  });
}

export function magnetometerToHeadingDeg(x: number, y: number): number {
  const deg = (Math.atan2(x, y) * 180) / Math.PI;
  return (deg + 360) % 360;
}
