import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadAmountSuggestionRobot } from "@/lib/robots";
import { AmountSuggestionRobotPanel } from "@/components/admin/AmountSuggestionRobotPanel";

export const dynamic = "force-dynamic";

export default async function AdminRobotsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const robot = await loadAmountSuggestionRobot();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Robotter</h1>
        <p className="text-sm text-text-secondary">
          Mængde-robotten finder den mest sandsynlige mængde pr. vare (fx agurk spist rå eller lagt i en opskrift), så
          mængde-slideren starter dér i stedet for på 0/100 g. Den bruger typetallet af, hvad folk faktisk vælger — ikke
          gennemsnittet — med nyere valg vægtet højest, et loft pr. bruger, trimning af tastefejl og kategoriens typiske
          mængde, når en vare har få data. I app&apos;en blandes brugerens egne seneste valg på.
        </p>
      </div>
      <AmountSuggestionRobotPanel initial={robot} />
    </div>
  );
}
