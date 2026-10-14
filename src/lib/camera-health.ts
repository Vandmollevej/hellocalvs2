// Vagthund for kamerabilledet (docs/DECISIONS.md 2026-10-14): på iPhone kan
// den levende video blive sort midt i flowet (sporet sættes på pause af
// systemet, siden lægges i baggrunden, eller browserens grafikproces
// genstarter), uden at JavaScript får en fejl. Et rigtigt kamerabillede er
// aldrig helt sort — selv i mørke er der sensorstøj — så er midten helt
// sort i nogle målinger i træk, er kameraet gået i stå og skal startes igen.

// Alle pixels under denne lysstyrke (0–255) = sort billede.
export const BLACK_MAX_LUMINANCE = 4;
// Så mange sorte målinger i træk (à WATCHDOG_INTERVAL_MS), før kameraet genstartes.
export const BLACK_SAMPLES = 4;
export const WATCHDOG_INTERVAL_MS = 500;
// Højst så mange genstarter pr. åbning af kameraet, så et dækket objektiv
// ikke giver en uendelig sløjfe.
export const MAX_CAMERA_RESTARTS = 3;

export function frameIsBlack(gray: ArrayLike<number>, maxLuminance = BLACK_MAX_LUMINANCE): boolean {
  if (!gray.length) return false;
  for (let index = 0; index < gray.length; index++) {
    if (gray[index] > maxLuminance) return false;
  }
  return true;
}

// Tæller sorte målinger i træk og melder én gang, når grænsen nås.
export class BlackFrameTracker {
  private count = 0;

  reset() {
    this.count = 0;
  }

  push(black: boolean): boolean {
    this.count = black ? this.count + 1 : 0;
    if (this.count < BLACK_SAMPLES) return false;
    this.count = 0;
    return true;
  }
}
