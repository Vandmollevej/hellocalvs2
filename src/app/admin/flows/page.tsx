import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { listFlows } from "@/lib/flows";
import { NewFlowForm } from "@/components/admin/FlowEditor";

export const dynamic = "force-dynamic";

// Flows (docs/DECISIONS.md 2026-09-27): egne flow-sider, der redigeres i
// telefon-editoren. Tooltip-popups bygges separat under samme menupunkt.
export default async function AdminFlowsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const flows = await listFlows();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Flow-sider</h1>
        <p className="mt-1 hf-type-body text-text-secondary">
          Egne flows: en række sider, der vises efter hinanden. Tryk på et flow for at redigere siderne på telefonen.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {flows.map((flow) => (
          <li key={flow.id}>
            <Link
              href={`/admin/flows/${flow.id}`}
              className="flex items-center gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4 hover:border-hf-green"
            >
              <div className="min-w-0 flex-1">
                <p className="hf-type-strong text-hf-black">{flow.name}</p>
                {flow.description && <p className="truncate hf-type-small text-text-muted">{flow.description}</p>}
              </div>
              <span className="hf-type-small text-text-secondary">
                {flow._count.pages} {flow._count.pages === 1 ? "side" : "sider"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 hf-type-small ${
                  flow.enabled ? "bg-hf-green-light text-hf-green-dark" : "bg-hf-tan text-text-secondary"
                }`}
              >
                {flow.enabled ? "Aktiv" : "Kladde"}
              </span>
            </Link>
          </li>
        ))}
        {flows.length === 0 && <li className="hf-type-body text-text-secondary">Ingen flows endnu.</li>}
      </ul>

      <NewFlowForm />
    </div>
  );
}
