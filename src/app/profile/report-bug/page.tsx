"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { ReportBugForm } from "@/components/ReportBugForm";

function ReportBugContent() {
  const searchParams = useSearchParams();
  return (
    <HfScreen title="Indberet fejl">
      <ReportBugForm productId={searchParams.get("productId")} />
    </HfScreen>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense fallback={null}>
      <ReportBugContent />
    </Suspense>
  );
}
