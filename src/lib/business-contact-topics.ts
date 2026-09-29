// Emner i business-kontaktformularen. Egen fil uden server-afhængigheder, så
// formularen (klient) og API'et (server) deler samme liste.

export const BUSINESS_TOPICS = [
  { value: "ads", label: "Annoncering i appen" },
  { value: "data", label: "Rapporter og indsigt" },
  { value: "products", label: "Produktdata (producent/kæde)" },
  { value: "health", label: "Sundhedsfaglige samarbejder" },
  { value: "press", label: "Presse" },
  { value: "other", label: "Andet" },
] as const;

export type BusinessTopic = (typeof BUSINESS_TOPICS)[number]["value"];

export function isBusinessTopic(value: string): value is BusinessTopic {
  return BUSINESS_TOPICS.some((t) => t.value === value);
}
