// Fortæller serveren, at en ret i Delte retter er klikket på, så den kan
// indgå i "Trender netop nu". Fejl ignoreres; navigationen må aldrig vente.
export function recipeClickKey(kind: "shared" | "hellofresh" | "valdemarsro", id: string) {
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
