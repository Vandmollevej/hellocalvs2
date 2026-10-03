// Telefonnummer (docs/DECISIONS.md 2026-10-02): obligatorisk for alle brugere,
// der kan logge ind, fordi det skal bruges til tofaktor-godkendelse (SMS).
// Nummeret gemmes normaliseret i E.164 (+<landekode><nummer>, kun cifre), så
// det kan sendes direkte til en SMS-udbyder senere.
//
// Ingen afhængighed af libphonenumber: vi tjekker kun det, SMS-afsendelse
// kræver — landekode, 8–15 cifre i alt (ITU E.164) og ingen bogstaver.

// Standard-landekode pr. region (User.region, GS1-landekode i src/lib/regions.ts).
// Skriver brugeren et nationalt nummer uden +, bruges denne.
const COUNTRY_CALLING_CODES: Record<string, string> = {
  DK: "45",
  SE: "46",
  NO: "47",
  FI: "358",
  IS: "354",
  DE: "49",
  GB: "44",
  NL: "31",
  US: "1",
};

export const DEFAULT_PHONE_REGION = "DK";

// Nationale numre uden landekode: landekode → forventet længde (cifre).
// Kun for lande, hvor længden er fast; ellers accepteres 4–14 cifre.
const NATIONAL_LENGTHS: Record<string, number> = { "45": 8, "47": 8, "354": 7 };

export type PhoneValidation =
  | { ok: true; e164: string }
  | { ok: false; reason: "empty" | "invalid" };

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

// Normaliserer brugerens indtastning til E.164 eller afviser den.
// Accepterer "+45 12 34 56 78", "0045 12345678", "12 34 56 78" (med region DK)
// og "(+45) 1234-5678". Mellemrum, bindestreger, punktummer og parenteser
// ignoreres.
export function validatePhone(input: string, region: string = DEFAULT_PHONE_REGION): PhoneValidation {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };

  // Kun tegn, der kan indgå i et skrevet telefonnummer.
  if (!/^[+\d\s().-]+$/.test(raw)) return { ok: false, reason: "invalid" };

  let digits: string;
  const compact = raw.replace(/[\s().-]+/g, "");
  if (compact.startsWith("+")) {
    digits = digitsOnly(compact.slice(1));
    if (compact.slice(1).includes("+")) return { ok: false, reason: "invalid" };
  } else if (compact.startsWith("00")) {
    digits = digitsOnly(compact.slice(2));
  } else {
    const national = digitsOnly(compact);
    const code = COUNTRY_CALLING_CODES[region.toUpperCase()] ?? COUNTRY_CALLING_CODES[DEFAULT_PHONE_REGION];
    const expected = NATIONAL_LENGTHS[code];
    if (expected !== undefined ? national.length !== expected : national.length < 4 || national.length > 14) {
      return { ok: false, reason: "invalid" };
    }
    // Nationale numre starter aldrig med 0 i E.164 (det er et trunk-præfiks).
    digits = code + national.replace(/^0+/, "");
  }

  // ITU E.164: højst 15 cifre, og et nummer uden landekode giver ingen mening.
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, e164: `+${digits}` };
}

export function isValidPhone(input: string, region?: string) {
  return validatePhone(input, region).ok;
}

// Visning: "+45 12 34 56 78" for danske numre, ellers "+<kode> <resten>".
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "";
  if (/^\+45\d{8}$/.test(e164)) {
    return `+45 ${e164.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return e164;
}

// Normaliserer et indtastet mobilnummer til E.164 (+45…). Nationale numre
// uden landekode regnes som danske. Returnerer null, hvis nummeret ikke ligner et.
export function normalizePhone(input: string): string | null {
  const result = validatePhone(input);
  return result.ok ? result.e164 : null;
}

// "+4512345678" -> "+45 ••• •• 78" til visning ("koden er sendt til …").
export function maskPhone(phone: string): string {
  const tail = phone.slice(-2);
  const country = phone.startsWith("+45") ? "+45" : phone.slice(0, 3);
  return `${country} ••• •• ${tail}`;
}
