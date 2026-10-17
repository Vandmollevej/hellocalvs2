"use client";

import { use } from "react";
import { ReportErrorScreen } from "@/components/report/ReportErrorScreen";

// "Fejl" på en vare uden registrering (søg, favoritter, indscanninger) —
// samme fejlmelding som fra Dagens tilføjelser (bruger 2026-10-17).
export default function ProductReportErrorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReportErrorScreen productId={id} />;
}
