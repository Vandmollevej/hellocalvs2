"use client";

import { use } from "react";
import { ReportErrorScreen } from "@/components/report/ReportErrorScreen";

// "Fejl" på en registrering (Dagens tilføjelser, kalenderen).
export default function RegistrationReportErrorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReportErrorScreen registrationId={id} />;
}
