// Kategorier til admin "Robotter" (filter). Nøglerne er jobbenes key fra
// registry.ts; ukendte robotter havner i "Andet".

export const ROBOT_CATEGORIES = [
  "Varer og næringsindhold",
  "Billeder og logoer",
  "Opskrifter og import",
  "Søgning og sprog",
  "Sundhed og sikkerhed",
  "Andet",
] as const;

export type RobotCategory = (typeof ROBOT_CATEGORIES)[number];

const BY_KEY: Record<string, RobotCategory> = {
  "energy-split-check": "Varer og næringsindhold",
  "back-photo-scan": "Varer og næringsindhold",
  "product-recheck": "Varer og næringsindhold",
  "off-quality": "Varer og næringsindhold",
  "external-sources-sweep": "Varer og næringsindhold",
  "frida-estimates": "Varer og næringsindhold",
  "alcohol-nutrition": "Varer og næringsindhold",
  "frida-import": "Varer og næringsindhold",
  "label-local": "Varer og næringsindhold",
  "back-photo-local": "Varer og næringsindhold",
  "recheck-local": "Varer og næringsindhold",
  "rema1000-import": "Varer og næringsindhold",
  "lidl-aldi-enrich": "Varer og næringsindhold",
  "quality-control-agent": "Varer og næringsindhold",
  "front-image-check": "Billeder og logoer",
  "image-cutout": "Billeder og logoer",
  "bria-compare": "Billeder og logoer",
  "logo-agent": "Billeder og logoer",
  "product-image-search": "Billeder og logoer",
  "image-agent": "Billeder og logoer",
  "valdemarsro-import": "Opskrifter og import",
  "retnemt-import": "Opskrifter og import",
  "betterfeast-import": "Opskrifter og import",
  "hellofresh-import": "Opskrifter og import",
  "spelling-check": "Søgning og sprog",
  "search-index": "Søgning og sprog",
  "product-translations": "Søgning og sprog",
  "search-miss-review": "Søgning og sprog",
  "language-local": "Søgning og sprog",
  "pet-food-scan": "Sundhed og sikkerhed",
  "pulse-activity": "Sundhed og sikkerhed",
};

export function robotCategory(key: string): RobotCategory {
  return BY_KEY[key] ?? "Andet";
}
