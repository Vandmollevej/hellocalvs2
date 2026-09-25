// Klientmarkering af egne ingredienser i en ret-kladde: produkt-ID'et får
// dette præfiks, så UI'et kan vise "Egen" og blokere deling. /api/dishes
// fjerner præfikset og tjekker ejerskabet.
export const PRIVATE_INGREDIENT_PREFIX = "private:";

export function isPrivateIngredientId(productId: string) {
  return productId.startsWith(PRIVATE_INGREDIENT_PREFIX);
}

export function stripPrivatePrefix(productId: string) {
  return isPrivateIngredientId(productId) ? productId.slice(PRIVATE_INGREDIENT_PREFIX.length) : productId;
}
