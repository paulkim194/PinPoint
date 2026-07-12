// Core data model. Kept intentionally flat and JSON-serializable so it can
// be persisted as-is via AsyncStorage (see src/services/storage.ts).

export type LandmarkCategory = 'stage' | 'gate' | 'meetup' | 'other';

export interface Landmark {
  id: string;
  name: string;
  category: LandmarkCategory;
  pixelX: number; // intrinsic image coordinates (not display/screen coordinates)
  pixelY: number;
}

export interface CalibrationAnchor {
  lat: number;
  lng: number;
  pixelX: number;
  pixelY: number;
  accuracyM: number; // GPS accuracy reading at capture time, in meters
}

export interface Calibration {
  anchors: CalibrationAnchor[];
}

export interface FestivalMap {
  id: string;
  name: string;
  imageUri: string; // local document-directory URI
  imageWidth: number; // intrinsic pixels
  imageHeight: number;
  landmarks: Landmark[];
  calibration: Calibration | null;
  createdAt: number;
}

// Shared with src/services/geo.ts (Phase: calibration/live tracking).
export interface LatLng {
  lat: number;
  lng: number;
}
