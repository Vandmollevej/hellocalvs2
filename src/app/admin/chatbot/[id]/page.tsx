import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getChatbotThreadForAdmin } from "@/lib/chatbot";
import { chatbotCategoryLabel } from "@/lib/chatbot-categories";
import {
  ageLabel,
  channelLabel,
  localeLabel,
  regionLabel,
  sexLabel,
  subscriptionStatusLabel,
  tierLabel,
} from "@/lib/chatbot-admin-labels";
import { formatAdminTime } from "@/lib/support-labels";
import { supportCaseCode } from "@/lib/support-inbox";
import { ChatbotThreadMessages } from "@/components/admin/chatbot/ChatbotThreadMessages";

// Én chatbot-samtale (docs/DECISIONS.md 2026-10-02): hele tråden + brugeren,
// både som ved samtalens start (øjebliksbillede) og som nu.
export default async function AdminChatbotThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const data = await getChatbotThreadForAdmin(id);
  if (!data) notFound();
  const { conversation, currentTier, currentAge, otherConversations } = data;
  const user = conversation.user;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/chatbot" className="hf-type-small text-text-secondary underline">
          ← Chatbot
        </Link>
        <h1 className="hf-type-title text-hf-black">Samtale med {user.displayName}</h1>
        <p className="hf-type-body text-text-secondary">
          {chatbotCategoryLabel(conversation.category)} · {conversation.questionCount} spørgsmål ·{" "}
          {channelLabel(conversation.channel)} · startet {formatAdminTime(conversation.createdAt)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="hf-panel">
          <ChatbotThreadMessages messages={conversation.messages} />
        </section>

        <aside className="flex flex-col gap-4">
          <section className="hf-panel">
            <h2 className="hf-type-title text-hf-black">Bruger</h2>
            <Facts
              rows={[
                ["Navn", user.displayName],
                ["Alder", ageLabel(currentAge)],
                ["Køn", sexLabel(user.sex)],
                ["Region", regionLabel(user.region)],
                ["Abonnement", `${tierLabel(currentTier, user.subscription?.plan)} (${subscriptionStatusLabel(user.subscription?.status)})`],
                ...(user.subscription?.currentPeriodEnd
                  ? ([["Periode slutter", formatAdminTime(user.subscription.currentPeriodEnd)]] as [string, string][])
                  : []),
                ["App-sprog", localeLabel(user.appLocale)],
                ["Bruger siden", formatAdminTime(user.createdAt)],
                ["Chatbot-samtaler", String(user._count.chatbotConversations)],
                ["Supportsager", String(user._count.supportRequests)],
              ]}
            />
          </section>

          <section className="hf-panel">
            <h2 className="hf-type-title text-hf-black">Ved samtalens start</h2>
            <Facts
              rows={[
                ["Alder", ageLabel(conversation.userAgeSnapshot)],
                ["Køn", sexLabel(conversation.userSexSnapshot)],
                ["Region", regionLabel(conversation.userRegionSnapshot)],
                ["Abonnement", tierLabel(conversation.userTierSnapshot, conversation.userPlanSnapshot)],
                ["App-sprog", localeLabel(conversation.userLocaleSnapshot)],
              ]}
            />
          </section>

          {conversation.supportRequest && (
            <section className="gap-1 hf-panel">
              <h2 className="hf-type-title text-hf-black">Sendt til medarbejder</h2>
              <p className="hf-type-small text-text-secondary">
                {conversation.escalatedAt ? formatAdminTime(conversation.escalatedAt) : ""} ·{" "}
                {conversation.supportRequest.status === "OPEN" ? "Åben" : "Løst"}
              </p>
              <Link href={`/admin/support/${conversation.supportRequest.id}`} className="hf-type-body text-hf-green-dark underline">
                Supportsag #{supportCaseCode(conversation.supportRequest.id)}
              </Link>
            </section>
          )}

          {otherConversations.length > 0 && (
            <section className="hf-panel">
              <h2 className="hf-type-title text-hf-black">Andre samtaler</h2>
              <ul className="flex flex-col gap-1">
                {otherConversations.map((other) => (
                  <li key={other.id}>
                    <Link href={`/admin/chatbot/${other.id}`} className="hf-type-small flex justify-between gap-2 hover:underline">
                      <span className="text-hf-black">{chatbotCategoryLabel(other.category)}</span>
                      <span className="text-text-muted">
                        {other.questionCount} · {formatAdminTime(other.lastMessageAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="hf-type-small grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-text-muted">{label}</dt>
          <dd className="break-words text-hf-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
