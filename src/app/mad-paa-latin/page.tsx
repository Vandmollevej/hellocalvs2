import type { Metadata } from "next";
import { FoodTermDirectory } from "./FoodTermDirectory";

export const metadata: Metadata = { title: "Mad på latin" };

// Ordbog over ikke-danske ingrediensnavne; ét afsnit pr. ord med eget anker,
// så ingredienslister kan linke direkte til det (DECISIONS 2026-09-28).
export default function FoodLatinPage() {
  return <FoodTermDirectory />;
}
