// Delt sessionStorage-cache mellem det guidede kamera-auto-flow
// (/camera/create) og opret-produkt-siden (/product/create) — alt brugeren har
// fotograferet og fået genkendt undervejs, så opret-siden kan prælægges uden
// et nyt kamera-kald.
export const PRODUCT_DRAFT_STORAGE_KEY = "hellocal-product-create-draft";

export type ProductCreateDraft = {
  name?: string;
  kcalPer100g?: string;
  proteinPer100g?: string;
  carbsPer100g?: string;
  fatPer100g?: string;
  servingSizeGrams?: string;
  ingredientsText?: string;
  barcodeValue?: string;
  barcodeImage?: string;
  nutritionImage?: string;
  ingredientsImage?: string;
  mainImage?: string;
  sideImages: [string?, string?, string?];
};
