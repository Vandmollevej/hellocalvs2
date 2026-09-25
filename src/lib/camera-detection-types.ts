// Shared types for the automatic "Produkt" camera detection
// (`/camera?mode=hellofresh`, POST /api/ai/detect-camera-objects).
//
// All coordinates are fractions (0–1) of the square frame the camera page
// sends — the same square the user sees in the viewfinder — so the overlay
// can draw them straight onto the frozen photo.

export type DetectionShape =
  // A round plate/bowl: outlined with an ellipse ("ring rundt om tallerkenen").
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  // Any other object (package, fruit, glass …): outlined with its contour.
  | { type: "polygon"; points: [number, number][] };

export type CameraDetectedItem = {
  id: string;
  title: string;
  amountGrams: number;
  amountLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  productId: string | null;
  image: string | null;
  estimated: boolean;
};

export type CameraDetection = {
  id: string;
  label: string;
  kind: "plate" | "object";
  shape: DetectionShape;
  items: CameraDetectedItem[];
};

export type CameraDetectionResponse = {
  detections: CameraDetection[];
};
