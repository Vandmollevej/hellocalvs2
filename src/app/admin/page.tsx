import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadAdminDashboard } from "@/lib/admin-dashboard";
import { isSupportOverdue } from "@/lib/support-inbox";
import { formatAdminTime, formatWaiting, SUPPORT_PRIORITY_LABELS } from "@/lib/support-labels";

// Admin-oversigt som widgets (Cloudflare-dashboardets opbygning,
// docs/DECISIONS.md 2026-09-27): fire tællerkasser øverst med de vigtigste
// ventende opgaver, derunder større bokse med de seneste beskeder,
// produkter og fejlrapporter samt øvrige opgaver. Alt linker til siden,
// hvor opgaven løses.

function StatCard({
  href,
  label,
  value,
  note,
  alert = false,
}: {
  href: string;
  label: string;
  value: number;
  note?: string | null;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border-strong bg-surface-2 p-4 hover:border-hf-green"
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${value > 0 ? "text-hf-green-dark" : "text-text-muted"}`}>{value}</p>
      <p className={`mt-auto pt-2 text-xs ${alert ? "text-hf-red-dark" : "text-text-muted"}`}>
        {note ?? (value > 0 ? "Gå til opgaverne →" : "Ingen ventende")}
      </p>
    </Link>
  );
}

function Widget({
  title,
  href,
  count,
  className = "",
  children,
}: {
  title: string;
  href: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-lg border border-border-strong bg-surface-2 ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-border-strong px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-text-muted">({count})</span>}
        </h2>
        <Link href={href} className="shrink-0 text-xs text-hf-green-dark hover:underline">
          Se alle →
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-text-muted">{text}</p>;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { counts, latestSupport, latestProducts, latestBugReports } = await loadAdminDashboard();
  const now = new Date();

  const otherTasks = [
    { href: "/admin/images", label: "Billedforslag", value: counts.pendingImages },
    { href: "/admin/logos", label: "Logoer til godkendelse", value: counts.pendingLogos },
    { href: "/admin/quality-control", label: "Kvalitetskontrol", value: counts.qualityControl },
    { href: "/admin/duplicate-products", label: "Dubletter", value: counts.duplicates },
    { href: "/admin/ingredient-requests", label: "Ønskede ingredienser", value: counts.ingredientRequests },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-text-primary">Oversigt</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          href="/admin/support?status=unanswered"
          label="Ubesvarede beskeder"
          value={counts.support.unanswered}
          note={counts.support.overdue > 0 ? `${counts.support.overdue} over 24 timer` : null}
          alert={counts.support.overdue > 0}
        />
        <StatCard href="/admin/products" label="Nye produkter" value={counts.pendingProducts} />
        <StatCard
          href="/admin/uncertainties"
          label="Usikkerheder"
          value={counts.uncertainties.total}
          note={counts.uncertainties.urgent > 0 ? `${counts.uncertainties.urgent} haster` : null}
          alert={counts.uncertainties.urgent > 0}
        />
        <StatCard href="/admin/bug-reports" label="Fejlrapporter" value={counts.bugReports} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="Seneste beskeder fra brugere"
          href="/admin/support"
          count={counts.support.unanswered}
          className="lg:col-span-2"
        >
          {latestSupport.length === 0 ? (
            <Empty text="Ingen åbne supportsager." />
          ) : (
            <ul className="divide-y divide-border-strong">
              {latestSupport.map((request) => {
                const overdue = isSupportOverdue({ ...request, status: "OPEN" }, now);
                return (
                  <li key={request.id}>
                    <Link href={`/admin/support/${request.id}`} className="block px-4 py-3 hover:bg-hf-tan">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`min-w-0 truncate text-sm text-text-primary ${
                            request.awaitingReply ? "font-semibold" : ""
                          }`}
                        >
                          {request.subject}
                        </p>
                        {request.awaitingReply ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                              overdue ? "bg-hf-red-dark text-hf-white" : "bg-hf-warning text-hf-warning-text"
                            }`}
                          >
                            {formatWaiting(request.lastUserMessageAt, now)}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-hf-tan px-2 py-0.5 text-xs text-text-secondary">
                            Besvaret
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {request.user.displayName} · {request.user.email} ·{" "}
                        {SUPPORT_PRIORITY_LABELS[request.priority]} prioritet ·{" "}
                        {formatAdminTime(request.lastUserMessageAt)}
                      </p>
                      {request.messages[0] && (
                        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{request.messages[0].body}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget title="Øvrige opgaver" href="/admin/quality-control">
          <ul className="divide-y divide-border-strong">
            {otherTasks.map((task) => (
              <li key={task.href}>
                <Link href={task.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hf-tan">
                  <span className="text-sm text-text-primary">{task.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      task.value > 0 ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-muted"
                    }`}
                  >
                    {task.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget
          title="Seneste produkter til godkendelse"
          href="/admin/products"
          count={counts.pendingProducts}
          className="lg:col-span-2"
        >
          {latestProducts.length === 0 ? (
            <Empty text="Ingen produkter afventer godkendelse." />
          ) : (
            <ul className="divide-y divide-border-strong">
              {latestProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hf-tan"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">
                        {product.brand?.name && <span className="font-semibold">{product.brand.name} </span>}
                        {product.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {product.externalSource ? `Automatisk (${product.externalSource})` : "Oprettet af bruger"} ·{" "}
                        {formatAdminTime(product.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-text-secondary">
                      {Math.round(product.kcalPer100g)} kcal/100 g
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Seneste fejlrapporter" href="/admin/bug-reports" count={counts.bugReports}>
          {latestBugReports.length === 0 ? (
            <Empty text="Ingen fejlrapporter afventer." />
          ) : (
            <ul className="divide-y divide-border-strong">
              {latestBugReports.map((report) => (
                <li key={report.id}>
                  <Link href="/admin/bug-reports" className="block px-4 py-3 hover:bg-hf-tan">
                    <p className="line-clamp-2 text-sm text-text-primary">{report.description}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {report.source === "AI" ? "AI" : (report.user?.displayName ?? "Bruger")} ·{" "}
                      {formatAdminTime(report.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  );
}
