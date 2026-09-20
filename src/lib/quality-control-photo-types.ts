export const QUALITY_CONTROL_PHOTO_TYPES = ["BARCODE", "NUTRITION", "INGREDIENTS"] as const;

export type QualityControlPhotoType = (typeof QUALITY_CONTROL_PHOTO_TYPES)[number];

export function isQualityControlPhotoType(value: string): value is QualityControlPhotoType {
  return QUALITY_CONTROL_PHOTO_TYPES.some((photoType) => photoType === value);
}

export function hasQualityControlPhotoType<T extends { photoType: string }>(
  value: T
): value is T & { photoType: QualityControlPhotoType } {
  return isQualityControlPhotoType(value.photoType);
}
