// Fortæller serveren, at en ret i Delte retter er klikket på, så den kan
// indgå i "Trender netop nu". Fejl ignoreres; navigationen må aldrig vente.
// Alle importerede retter (måltidskasser og Valdemarsro) deler "hf:"-nøglen.
export function recipeClickKey(kind: string, id: string) {
  return `${kind === "shared" ? "shared" : "hf"}:${id}`;
}

export function trackRecipeClick(key: string) {
  void fetch("/api/recipe-clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
    keepalive: true,
  }).catch(() => undefined);
}
