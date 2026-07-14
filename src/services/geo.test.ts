import { bearingAndDistance, bearingAndDistanceToPixel, computeTransform, gpsToPixel } from './geo';
import type { Calibration } from '../types';

// 1 degree of latitude, or of longitude at the equator, is ~111,194.93m on
// a sphere of Earth's mean radius (6,371,000m): R * (pi/180).
const METERS_PER_DEGREE = 111194.93;

describe('computeTransform + gpsToPixel: simple east-west (unrotated) map', () => {
  // Anchor 2 is exactly 500m due east of anchor 1, and the map is drawn
  // "north up" with no rotation: east maps directly to +pixelX.
  const lng2 = 500 / 111320; // meters -> degrees longitude at the equator
  const calibration: Calibration = {
    anchors: [
      { lat: 0, lng: 0, pixelX: 100, pixelY: 100, accuracyM: 5 },
      { lat: 0, lng: lng2, pixelX: 300, pixelY: 100, accuracyM: 5 },
    ],
  };
  const transform = computeTransform(calibration);

  it('reproduces both calibration anchors exactly', () => {
    const p1 = gpsToPixel(transform, 0, 0);
    expect(p1.x).toBeCloseTo(100, 5);
    expect(p1.y).toBeCloseTo(100, 5);

    const p2 = gpsToPixel(transform, 0, lng2);
    expect(p2.x).toBeCloseTo(300, 5);
    expect(p2.y).toBeCloseTo(100, 5);
  });

  it('places the GPS midpoint at the pixel midpoint', () => {
    const mid = gpsToPixel(transform, 0, lng2 / 2);
    expect(mid.x).toBeCloseTo(200, 5);
    expect(mid.y).toBeCloseTo(100, 5);
  });

  it('computes the correct meters-per-pixel scale', () => {
    // 500m spans 200px, so 2.5m per pixel.
    expect(transform.metersPerPixel).toBeCloseTo(2.5, 5);
  });

  it('bearingAndDistanceToPixel: standing at anchor 1, target at anchor 2 (due east)', () => {
    const result = bearingAndDistanceToPixel(transform, 0, 0, 300, 100);
    expect(result.distanceM).toBeCloseTo(500, 5);
    expect(result.bearingDeg).toBeCloseTo(90, 5);
  });
});

describe('computeTransform + gpsToPixel: 90-degree-rotated map', () => {
  // Anchor 2 is exactly 500m due NORTH of anchor 1, but on this map "north"
  // points along +pixelX (image right) instead of -pixelY (image up) -- i.e.
  // the printed map is rotated 90 degrees relative to true north-up.
  const lat1 = 10;
  const lng1 = 20;
  const lat2 = lat1 + 500 / 110540; // meters -> degrees latitude
  const calibration: Calibration = {
    anchors: [
      { lat: lat1, lng: lng1, pixelX: 150, pixelY: 150, accuracyM: 5 },
      { lat: lat2, lng: lng1, pixelX: 350, pixelY: 150, accuracyM: 5 },
    ],
  };
  const transform = computeTransform(calibration);

  it('reproduces both calibration anchors exactly despite the rotation', () => {
    const p1 = gpsToPixel(transform, lat1, lng1);
    expect(p1.x).toBeCloseTo(150, 5);
    expect(p1.y).toBeCloseTo(150, 5);

    const p2 = gpsToPixel(transform, lat2, lng1);
    expect(p2.x).toBeCloseTo(350, 5);
    expect(p2.y).toBeCloseTo(150, 5);
  });

  it('places the GPS midpoint at the pixel midpoint (rotation-agnostic)', () => {
    const mid = gpsToPixel(transform, (lat1 + lat2) / 2, lng1);
    expect(mid.x).toBeCloseTo(250, 5);
    expect(mid.y).toBeCloseTo(150, 5);
  });

  it('computes the correct meters-per-pixel scale regardless of rotation', () => {
    expect(transform.metersPerPixel).toBeCloseTo(2.5, 5);
  });

  it('bearingAndDistanceToPixel: standing at anchor 1, target at anchor 2 (due north despite rotation)', () => {
    const result = bearingAndDistanceToPixel(transform, lat1, lng1, 350, 150);
    expect(result.distanceM).toBeCloseTo(500, 5);
    expect(result.bearingDeg).toBeCloseTo(0, 5);
  });
});

describe('computeTransform: degenerate input', () => {
  it('throws if the two anchors are the same point', () => {
    const calibration: Calibration = {
      anchors: [
        { lat: 1, lng: 1, pixelX: 10, pixelY: 10, accuracyM: 5 },
        { lat: 1, lng: 1, pixelX: 10, pixelY: 10, accuracyM: 5 },
      ],
    };
    expect(() => computeTransform(calibration)).toThrow();
  });
});

describe('bearingAndDistance', () => {
  it('due north: bearing 0 degrees', () => {
    const result = bearingAndDistance({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(result.bearingDeg).toBeCloseTo(0, 1);
    expect(result.distanceM).toBeCloseTo(METERS_PER_DEGREE, -1);
  });

  it('due east at the equator: bearing 90 degrees', () => {
    const result = bearingAndDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(result.bearingDeg).toBeCloseTo(90, 1);
    expect(result.distanceM).toBeCloseTo(METERS_PER_DEGREE, -1);
  });

  it('due south: bearing 180 degrees', () => {
    const result = bearingAndDistance({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
    expect(result.bearingDeg).toBeCloseTo(180, 1);
  });

  it('due west at the equator: bearing 270 degrees', () => {
    const result = bearingAndDistance({ lat: 0, lng: 1 }, { lat: 0, lng: 0 });
    expect(result.bearingDeg).toBeCloseTo(270, 1);
  });

  it('same point: zero distance', () => {
    const result = bearingAndDistance({ lat: 5, lng: 5 }, { lat: 5, lng: 5 });
    expect(result.distanceM).toBeCloseTo(0, 5);
  });
});
