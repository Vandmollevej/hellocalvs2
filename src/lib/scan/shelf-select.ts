// Felter som scan-appen får om et hyldebillede og dets overlay-varer.
export const SHELF_PHOTO_SELECT = {
  id: true,
  imageUrl: true,
  capturedAt: true,
  storeName: true,
  analysisStatus: true,
  items: {
    select: {
      id: true,
      x: true,
      y: true,
      w: true,
      h: true,
      detectedName: true,
      detectedBrand: true,
      status: true,
      matchConfidence: true,
      manuallyAssigned: true,
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
  },
} as const;
