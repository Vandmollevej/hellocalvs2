// ZXing Binarizer whose scan lines are thresholded locally (see
// `barcode-row-threshold.ts`), so a shadow across part of a barcode no
// longer stops the decode. Only `getBlackRow` matters for the EAN/UPC
// readers; `getBlackMatrix` (2D codes) delegates to ZXing's HybridBinarizer.

import { Binarizer, BitArray, HybridBinarizer, type BitMatrix, type LuminanceSource } from "@zxing/library";
import { thresholdRowLocally } from "@/lib/barcode-row-threshold";

export class LocalRowBinarizer extends Binarizer {
  private luminances = new Uint8ClampedArray(0);

  constructor(source: LuminanceSource) {
    super(source);
  }

  getBlackRow(y: number, row: BitArray | null): BitArray {
    const source = this.getLuminanceSource();
    const width = source.getWidth();
    if (!row || row.getSize() < width) row = new BitArray(width);
    else row.clear();
    if (this.luminances.length < width) this.luminances = new Uint8ClampedArray(width);
    const luminances = source.getRow(y, this.luminances);
    const dark = thresholdRowLocally(luminances, width);
    for (let x = 0; x < width; x += 1) if (dark[x]) row.set(x);
    return row;
  }

  getBlackMatrix(): BitMatrix {
    return new HybridBinarizer(this.getLuminanceSource()).getBlackMatrix();
  }

  createBinarizer(source: LuminanceSource): Binarizer {
    return new LocalRowBinarizer(source);
  }
}
