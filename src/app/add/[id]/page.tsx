"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AddProductView } from "@/components/add/AddProductView";

function AddContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  return (
    <AddProductView
      id={id}
      forDish={searchParams.get("for") === "ret"}
      initialTime={searchParams.get("time")}
      initialDate={searchParams.get("date")}
    />
  );
}

export default function AddPage() {
  return (
    <Suspense fallback={null}>
      <AddContent />
    </Suspense>
  );
}
