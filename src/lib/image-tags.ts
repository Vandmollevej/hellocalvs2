// Metatags on individual images (Product/Ingredient/GenericIngredient
// galleries), decoupled from the product/ingredient record itself — see
// docs/DECISIONS.md 2026-09-19 (image variant tags). A product can have a
// packaged default photo (Product.imageUrl) plus separately tagged variants
// picked by context, e.g. a "Raw" photo shown while building a dish/recipe
// even though the default photo shows the packaged/prepared item.
export const IMAGE_TAG_MULTIPLE = "Multiple";
export const IMAGE_TAG_RAW = "Raw";

export type TaggedImage = { url: string; tags: string[] };

export function findTaggedImageUrl(images: TaggedImage[] | undefined, tag: string): string | undefined {
  return images?.find((image) => image.tags.includes(tag))?.url;
}

// Picks the image to show while the user is building a dish/recipe
// (tilberedning) rather than logging a finished/consumed item — prefers a
// "Raw" tagged image when one exists, otherwise the ordinary default image.
export function selectRawContextImageUrl(
  defaultUrl: string | null | undefined,
  images: TaggedImage[] | undefined
): string | null {
  return findTaggedImageUrl(images, IMAGE_TAG_RAW) ?? defaultUrl ?? null;
}
