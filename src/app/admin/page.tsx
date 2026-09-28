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
      className="group flex flex-col rounded-lg border border-hf-tan-dark bg-hf-white p-4 hover:border-hf-green"
    >
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className={`hf-type-hero mt-1 ${value > 0 ? "text-hf-green-dark" : "text-text-muted"}`}>{value}</p>
      <p className={`hf-type-small mt-auto pt-2 ${alert ? "text-hf-red-dark" : "text-text-muted"}`}>
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
    <section className={`flex flex-col rounded-lg border border-hf-tan-dark bg-hf-white ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-hf-tan-dark px-4 py-3">
        <h2 className="hf-type-body hf-type-strong text-hf-black">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-text-muted">({count})</span>}
        </h2>
        <Link href={href} className="hf-type-small shrink-0 text-hf-green-dark hover:underline">
          Se alle →
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="hf-type-body px-4 py-8 text-center text-text-muted">{text}</p>;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const now = new Date();
  const { counts, latestSupport, latestProducts, latestBugReports, messages, jobs, missingApiKeys, stats } =
    await loadAdminDashboard(now);
  const failingJobs = jobs.filter((job) => job.lastStatus === "ERROR").length;

  const otherTasks = [
    { href: "/admin/images", label: "Billedforslag", value: counts.pendingImages },
    { href: "/admin/logos", label: "Logoer til godkendelse", value: counts.pendingLogos },
    { href: "/admin/quality-control", label: "Kvalitetskontrol", value: counts.qualityControl },
    { href: "/admin/duplicate-products", label: "Dubletter", value: counts.duplicates },
    { href: "/admin/ingredient-requests", label: "Ønskede ingredienser", value: counts.ingredientRequests },
    { href: "/admin/scan-invites", label: "Scan-indsendelser", value: counts.scanSubmissions },
    { href: "/admin/scan-invites", label: "Ulæste scan-beskeder", value: counts.scanMessages },
  ];

  const deliveryTasks = [
    { href: "/admin/messaging", label: "Mails/push fejlet (24 t)", value: messages.failed24h, alert: true },
    { href: "/admin/messaging", label: "Mails/push i kø", value: messages.queued },
    { href: "/admin/cron-jobs", label: "Cron-jobs med fejl", value: failingJobs, alert: true },
    { href: "/admin/api-keys", label: "Tjenester uden API-nøgle", value: missingApiKeys.length, alert: true },
  ];

  const keyFigures = [
    { href: "/admin/users", label: "Brugere i alt", value: stats.totalUsers },
    { href: "/admin/users", label: "Nye brugere i dag", value: stats.newUsersToday },
    { href: "/admin/users", label: "Nye brugere (7 dage)", value: stats.newUsersWeek },
    { href: "/admin/statistics", label: "Registreringer i dag", value: stats.registrationsToday },
    { href: "/admin/product-database", label: "Godkendte produkter", value: stats.approvedProducts },
    { href: "/admin/messaging", label: "Mails/push sendt (24 t)", value: messages.sent24h },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="hf-type-title text-hf-black">Oversigt</h1>

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
                          className={`hf-type-body min-w-0 truncate text-hf-black ${
                            request.awaitingReply ? "hf-type-strong" : ""
                          }`}
                        >
                          {request.subject}
                        </p>
                        {request.awaitingReply ? (
                          <span
                            className={`hf-type-small shrink-0 rounded-full px-2 py-0.5 ${
                              overdue ? "bg-hf-red-dark text-hf-white" : "bg-hf-warning text-hf-warning-text"
                            }`}
                          >
                            {formatWaiting(request.lastUserMessageAt, now)}
                          </span>
                        ) : (
                          <span className="hf-type-small shrink-0 rounded-full bg-hf-tan px-2 py-0.5 text-text-secondary">
                            Besvaret
                          </span>
                        )}
                      </div>
                      <p className="hf-type-small mt-0.5 truncate text-text-muted">
                        {request.user.displayName} · {request.user.email} ·{" "}
                        {SUPPORT_PRIORITY_LABELS[request.priority]} prioritet ·{" "}
                        {formatAdminTime(request.lastUserMessageAt)}
                      </p>
                      {request.messages[0] && (
                        <p className="hf-type-body mt-1 line-clamp-2 text-text-secondary">{request.messages[0].body}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget title="Øvrige opgaver" href="/admin/quality-control">
          <TaskList tasks={otherTasks} />
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
                      <p className="hf-type-body truncate text-hf-black">
                        {product.brand?.name && <span className="hf-type-strong">{product.brand.name} </span>}
                        {product.name}
                      </p>
                      <p className="hf-type-small mt-0.5 truncate text-text-muted">
                        {product.externalSource ? `Automatisk (${product.externalSource})` : "Oprettet af bruger"} ·{" "}
                        {formatAdminTime(product.createdAt)}
                      </p>
                    </div>
                    <span className="hf-type-small shrink-0 text-text-secondary">
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
                    <p className="hf-type-body line-clamp-2 text-hf-black">{report.description}</p>
                    <p className="hf-type-small mt-0.5 truncate text-text-muted">
                      {report.source === "AI" ? "AI" : (report.user?.displayName ?? "Bruger")} ·{" "}
                      {formatAdminTime(report.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="Produkter med lav sikkerhed"
          href="/admin/uncertainties"
          count={counts.uncertainties.total}
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2 border-b border-border-strong px-4 py-3">
            {counts.uncertainties.byTab.map((tab) => (
              <span key={tab.key} className="hf-type-small rounded-full bg-hf-tan px-2 py-0.5 text-text-secondary">
                {tab.label} <span className="hf-type-strong text-hf-black">{tab.count}</span>
              </span>
            ))}
            <span
              className={`hf-type-small rounded-full px-2 py-0.5 ${
                counts.uncertainties.hiddenFromSearch > 0 ? "bg-hf-red-dark text-hf-white" : "bg-hf-tan text-text-muted"
              }`}
            >
              Skjult i søgning {counts.uncertainties.hiddenFromSearch}
            </span>
          </div>
          {counts.uncertainties.top.length === 0 ? (
            <Empty text="Ingen usikre produkter." />
          ) : (
            <ul className="divide-y divide-border-strong">
              {counts.uncertainties.top.map((row) => (
                <li key={row.id}>
                  <Link
                    href="/admin/uncertainties"
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hf-tan"
                  >
                    <div className="min-w-0">
                      <p className="hf-type-body truncate text-hf-black">
                        {row.brandName && <span className="hf-type-strong">{row.brandName} </span>}
                        {row.productName}
                      </p>
                      <p className="hf-type-small mt-0.5 truncate text-text-muted">{row.tabLabel}</p>
                    </div>
                    <span
                      className={`hf-type-small shrink-0 rounded-full px-2 py-0.5 ${
                        row.urgent ? "bg-hf-red-dark text-hf-white" : "bg-hf-warning text-hf-warning-text"
                      }`}
                    >
                      {row.uncertaintyPercent} % usikker
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Drift" href="/admin/cron-jobs">
          <TaskList tasks={deliveryTasks} />
          {missingApiKeys.length > 0 && (
            <p className="hf-type-small border-t border-border-strong px-4 py-3 text-text-muted">
              Mangler nøgle: {missingApiKeys.join(", ")}
            </p>
          )}
        </Widget>

        <Widget title="Cron-jobs" href="/admin/cron-jobs" className="lg:col-span-2">
          <ul className="divide-y divide-border-strong">
            {jobs.map((job) => (
              <li key={job.key}>
                <Link href="/admin/cron-jobs" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hf-tan">
                  <div className="min-w-0">
                    <p className="hf-type-body truncate text-hf-black">{job.name}</p>
                    {job.lastStatus === "ERROR" && job.lastMessage && (
                      <p className="hf-type-small mt-0.5 truncate text-hf-red-dark">{job.lastMessage}</p>
                    )}
                  </div>
                  <span
                    className={`hf-type-small shrink-0 ${
                      job.lastStatus === "ERROR" ? "text-hf-red-dark" : "text-text-muted"
                    }`}
                  >
                    {!job.enabled
                      ? "Slået fra"
                      : job.lastStatus === "ERROR"
                        ? "Fejl"
                        : job.lastRunAt
                          ? `Kørt ${formatAdminTime(job.lastRunAt)}`
                          : "Ikke kørt endnu"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {messages.recentFailed.length > 0 && (
            <div className="border-t border-border-strong">
              <p className="hf-type-small hf-type-strong px-4 pt-3 text-text-secondary">Mislykkede beskeder (7 dage)</p>
              <ul className="divide-y divide-border-strong">
                {messages.recentFailed.map((message) => (
                  <li key={message.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <p className="hf-type-small min-w-0 truncate text-text-secondary">
                      {message.event} · {message.channel}
                      {message.error ? ` · ${message.error}` : ""}
                    </p>
                    <span className="hf-type-small shrink-0 text-text-muted">{formatAdminTime(message.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Widget>

        <Widget title="Nøgletal" href="/admin/statistics">
          <TaskList tasks={keyFigures} neutral />
        </Widget>
      </div>
    </div>
  );
}

// neutral: rene nøgletal (samme farve uanset værdi). alert: rødt, når > 0.
function TaskList({
  tasks,
  neutral = false,
}: {
  tasks: { href: string; label: string; value: number; alert?: boolean }[];
  neutral?: boolean;
}) {
  return (
    <ul className="divide-y divide-border-strong">
      {tasks.map((task) => (
        <li key={task.label}>
          <Link href={task.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-hf-tan">
            <span className="hf-type-body text-hf-black">{task.label}</span>
            <span
              className={`hf-type-small hf-type-strong rounded-full px-2 py-0.5 ${
                neutral
                  ? "bg-hf-tan text-hf-black"
                  : task.value > 0
                    ? task.alert
                      ? "bg-hf-red-dark text-hf-white"
                      : "bg-hf-green-dark text-hf-white"
                    : "bg-hf-tan text-text-muted"
              }`}
            >
              {task.value.toLocaleString("da-DK")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
