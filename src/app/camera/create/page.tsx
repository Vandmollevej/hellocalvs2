import { redirect } from "next/navigation";

// Det guidede produktflow bor nu på /camera (stregkode → forside → energi →
// indhold med fire knapper under kameraet), docs/DECISIONS.md 2026-09-27.
export default function KameraOpretPage() {
  redirect("/camera?mode=product");
}
