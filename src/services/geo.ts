// GPS <-> image-pixel coordinate math. Pure functions, no React/RN imports,
// so this is unit-testable in plain Node (see geo.test.ts).
//
// Approach: project lat/lng to a local flat plane (equirectangular
// approximation, accurate to centimeters at festival/park scale), then solve
// a 2D similarity transform (uniform scale + rotation + translation) from
// the two calibration anchor pairs. Two point correspondences give exactly
// 4 constraints for a similarity transform's 4 degrees of freedom (scale,
// rotation, tx, ty), so the transform reproduces both anchors exactly and
// interpolates/extrapolates linearly everywhere else.
import type { Calibration, LatLng } from '../types';

const EARTH_RADIUS_M = 6371000;
// Meters per degree of latitude/longitude at the equator -- the standard
// equirectangular-projection constants.
const METERS_PER_DEG_LAT = 110540;
const METERS_PER_DEG_LNG_AT_EQUATOR = 111320;

export interface GpsToPixelTransform {
  /** Origin of the local plane projection (anchor 1's lat/lng). */
  lat0: number;
  lng0: number;
  /** Pixels per meter in the local plane. */
  scale: number;
  /** Meters per pixel -- the inverse of `scale`, exposed for sizing UI like the accuracy halo. */
  metersPerPixel: number;
  /** Rotation (radians) applied to plane coordinates before scaling into pixel space. */
  rotation: number;
  /** Pixel-space translation. */
  tx: number;
  ty: number;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Projects a lat/lng to a local flat plane (meters), centered on (lat0, lng0).
 * Equirectangular approximation: accurate to centimeters at the scale of a
 * festival or park, not intended for large distances.
 */
function projectToPlane(lat0: number, lng0: number, lat: number, lng: number): { x: number; y: number } {
  const x = (lng - lng0) * Math.cos(toRadians(lat0)) * METERS_PER_DEG_LNG_AT_EQUATOR;
  const y = (lat - lat0) * METERS_PER_DEG_LAT;
  return { x, y };
}

/**
 * Solves the two-anchor similarity transform from a Calibration's two
 * anchor pairs (GPS <-> pixel). Requires exactly 2 anchors.
 */
export function computeTransform(calibration: Calibration): GpsToPixelTransform {
  const [a1, a2] = calibration.anchors;
  if (!a1 || !a2) {
    throw new Error('computeTransform requires exactly 2 calibration anchors');
  }

  const lat0 = a1.lat;
  const lng0 = a1.lng;

  // a1 projects to the plane origin (0, 0) by construction.
  const p2 = projectToPlane(lat0, lng0, a2.lat, a2.lng);

  const dPlaneX = p2.x;
  const dPlaneY = p2.y;
  const dPixX = a2.pixelX - a1.pixelX;
  const dPixY = a2.pixelY - a1.pixelY;

  const planeDist = Math.hypot(dPlaneX, dPlaneY);
  const pixDist = Math.hypot(dPixX, dPixY);
  if (planeDist === 0 || pixDist === 0) {
    throw new Error('Calibration anchors are too close together to solve a transform');
  }

  const scale = pixDist / planeDist; // pixels per meter
  const rotation = Math.atan2(dPixY, dPixX) - Math.atan2(dPlaneY, dPlaneX);

  // a1 (plane origin) must map to a1's pixel position, so translation = a1's pixel.
  const tx = a1.pixelX;
  const ty = a1.pixelY;

  return { lat0, lng0, scale, metersPerPixel: 1 / scale, rotation, tx, ty };
}

/** Applies a solved transform to a lat/lng, returning the corresponding pixel position. */
export function gpsToPixel(t: GpsToPixelTransform, lat: number, lng: number): { x: number; y: number } {
  const { x: px, y: py } = projectToPlane(t.lat0, t.lng0, lat, lng);
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return {
    x: t.scale * (px * cos - py * sin) + t.tx,
    y: t.scale * (px * sin + py * cos) + t.ty,
  };
}

/**
 * Haversine great-circle distance and standard initial compass bearing
 * from one GPS point to another. Used for the navigation banner
 * ("Wasteland ↗ 420m").
 */
export function bearingAndDistance(from: LatLng, to: LatLng): { bearingDeg: number; distanceM: number } {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceM = EARTH_RADIUS_M * c;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearingDeg = (toDegrees(Math.atan2(y, x)) + 360) % 360;

  return { bearingDeg, distanceM };
}

/**
 * Bearing (compass degrees, clockwise from true north) and distance (meters)
 * from a live GPS position to a landmark that only has image-pixel
 * coordinates -- landmarks are never given their own lat/lng, so this skips
 * an explicit pixel->GPS inverse projection: pixel-space Euclidean distance
 * already equals real-world distance once divided by the transform's scale
 * (a similarity transform preserves length ratios uniformly everywhere),
 * and un-rotating the pixel-space delta by -transform.rotation recovers its
 * true-north-relative direction. Used for the "Wasteland ↗ 420m" banner.
 */
export function bearingAndDistanceToPixel(
  t: GpsToPixelTransform,
  userLat: number,
  userLng: number,
  targetPixelX: number,
  targetPixelY: number
): { bearingDeg: number; distanceM: number } {
  const userPixel = gpsToPixel(t, userLat, userLng);
  const dPixX = targetPixelX - userPixel.x;
  const dPixY = targetPixelY - userPixel.y;

  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  // Inverse-rotate the pixel-space delta back into the local plane's
  // (east, north) meter space.
  const dPlaneX = (dPixX * cos + dPixY * sin) / t.scale;
  const dPlaneY = (-dPixX * sin + dPixY * cos) / t.scale;

  const distanceM = Math.hypot(dPlaneX, dPlaneY);
  const bearingDeg = (toDegrees(Math.atan2(dPlaneX, dPlaneY)) + 360) % 360;

  return { bearingDeg, distanceM };
}
