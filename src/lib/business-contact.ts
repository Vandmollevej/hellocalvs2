import { sendTransientMail } from "@/lib/transient-mail";
import { BUSINESS_TOPICS, isBusinessTopic, type BusinessTopic } from "@/lib/business-contact-topics";

// Business-kontaktformularen (/business): henvendelser fra partnere og presse
// sendes som mail til Hello Cal (BUSINESS_CONTACT_EMAIL, ellers support@).
// Intet gemmes i databasen.

export type BusinessContactInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  topic: BusinessTopic;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseBusinessContact(body: Record<string, unknown>): BusinessContactInput | string {
  const input = {
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    topic: clean(body.topic, 20) as BusinessTopic,
    message: clean(body.message, 5000),
  };
  if (!input.name || !input.company) return "Udfyld navn og virksomhed.";
  if (!EMAIL_RE.test(input.email)) return "Skriv en gyldig e-mailadresse.";
  if (!isBusinessTopic(input.topic)) return "Vælg et emne.";
  if (input.message.length < 10) return "Skriv lidt mere om din henvendelse.";
  return input;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export async function sendBusinessContact(input: BusinessContactInput) {
  const topic = BUSINESS_TOPICS.find((t) => t.value === input.topic)?.label ?? input.topic;
  const rows: [string, string][] = [
    ["Navn", input.name],
    ["Virksomhed", input.company],
    ["E-mail", input.email],
    ["Telefon", input.phone || "—"],
    ["Emne", topic],
  ];
  const html = `
    <h2>Ny business-henvendelse</h2>
    <table>${rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("")}</table>
    <p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`;
  await sendTransientMail({
    to: process.env.BUSINESS_CONTACT_EMAIL || "support@hellocal.io",
    subject: `Business: ${topic} — ${input.company}`,
    html,
    replyTo: input.email,
  });
}
