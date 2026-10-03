// Normaliserer et indtastet mobilnummer til E.164 (+45…). Otte cifre uden
// landekode regnes som danske. Returnerer null, hvis nummeret ikke ligner et.
export function normalizePhone(input: string): string | null {
  let value = input.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^\d{8}$/.test(value)) value = `+45${value}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

// "+4512345678" -> "+45 ••• •• 78" til visning ("koden er sendt til …").
export function maskPhone(phone: string): string {
  const tail = phone.slice(-2);
  const country = phone.startsWith("+45") ? "+45" : phone.slice(0, 3);
  return `${country} ••• •• ${tail}`;
}
