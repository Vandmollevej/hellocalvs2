"use client";

import dynamic from "next/dynamic";

// Kladden læser browserens lager ved start, så den renderes kun i browseren.
export const MessageDraftLoader = dynamic(
  () => import("@/components/admin/MessageDraftEditor").then((module) => module.MessageDraftEditor),
  { ssr: false },
);
