// Danske navne på besked-events i admin (liste og telefon-editor). Adminbrugere
// skal aldrig se event-koderne, så hver event har et læsbart navn og en gruppe.
export const EVENT_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: "Konto oprettet",
  EMAIL_VERIFICATION: "E-mail-verifikation",
  PASSWORD_RESET: "Glemt kodeord",
  PASSWORD_CHANGED: "Adgangskode ændret",
  NEW_DEVICE_LOGIN: "Login fra ny enhed",
  START_WEIGHT_CHANGE: "Ændring af startvægt",
  FRIEND_REFERRAL: "Invitér en ven — belønning givet",
  FRIEND_INVITATION: "Invitation til en ven",
  FRIEND_FORWARD_RECEIVED: "Videresendelse modtaget",
  DOCTOR_SHARE_INVITATION: "Invitation til læge",
  FAMILY_INVITATION: "Invitation til familie",
  PRODUCT_APPROVED: "Vare godkendt",
  PRODUCT_REJECTED: "Vare afvist",
  RECIPE_SHARE_REJECTED: "Delt ret afvist",
  INGREDIENT_REQUEST_ADMIN: "Admin: ny ingrediens-anmodning",
  PRODUCT_ESCALATION_ADMIN: "Admin: vare venter >48 timer",
  BUG_REPORT_ESCALATION_ADMIN: "Admin: fejlrapport venter >48 timer",
  BUG_REPORT_RESOLVED: "Fejlrapport løst",
  BUG_REPORT_REJECTED: "Fejlrapport afvist",
  POINTS_AWARDED: "Points tildelt",
  ADMIN_MESSAGE: "Besked fra admin",
  SUPPORT_RECEIVED: "Support: henvendelse modtaget",
  SUPPORT_REPLY: "Support: svar til bruger",
  SUPPORT_OVERDUE_ADMIN: "Admin: supportsag overskredet",
};

// Grupper med overskrifter i Besked automatisering.
export const EVENT_GROUPS: { label: string; events: string[] }[] = [
  {
    label: "Konto og login",
    events: ["ACCOUNT_CREATED", "EMAIL_VERIFICATION", "PASSWORD_RESET", "PASSWORD_CHANGED", "NEW_DEVICE_LOGIN", "START_WEIGHT_CHANGE"],
  },
  {
    label: "Invitationer og venner",
    events: ["FRIEND_INVITATION", "FRIEND_REFERRAL", "FRIEND_FORWARD_RECEIVED", "DOCTOR_SHARE_INVITATION", "FAMILY_INVITATION"],
  },
  {
    label: "Varer og retter",
    events: ["PRODUCT_APPROVED", "PRODUCT_REJECTED", "RECIPE_SHARE_REJECTED", "POINTS_AWARDED"],
  },
  {
    label: "Support og fejlrapporter",
    events: ["SUPPORT_RECEIVED", "SUPPORT_REPLY", "BUG_REPORT_RESOLVED", "BUG_REPORT_REJECTED", "ADMIN_MESSAGE"],
  },
  {
    label: "Beskeder til admin",
    events: ["INGREDIENT_REQUEST_ADMIN", "PRODUCT_ESCALATION_ADMIN", "BUG_REPORT_ESCALATION_ADMIN", "SUPPORT_OVERDUE_ADMIN"],
  },
];

// Kanal er gemt som EMAIL / PUSH / BOTH; i admin vises to til/fra-knapper.
export function channelFlags(channel: string) {
  return { email: channel !== "PUSH", push: channel !== "EMAIL" };
}

export function channelFromFlags(email: boolean, push: boolean): string {
  if (email && push) return "BOTH";
  return push ? "PUSH" : "EMAIL";
}
