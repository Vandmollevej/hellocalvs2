// Datooverskrift i de fælles kortlister (src/components/hf/ItemList.tsx):
// "I dag", "I går" eller "fredag 2. oktober" (+ år, hvis ikke i år).
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayHeadingLabel(date: Date, intlLocale: string, labels: { today: string; yesterday: string }) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return labels.today;
  if (dayKey(date) === dayKey(yesterday)) return labels.yesterday;
  return new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}
