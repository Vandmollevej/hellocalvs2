import { chatbotCategoryLabel } from "@/lib/chatbot-categories";
import { formatAdminTime } from "@/lib/support-labels";

type ThreadMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  body: string;
  category: string | null;
  needsHuman: boolean;
  links: string[];
  createdAt: Date;
};

// En hel chatbot-tråd i admin (docs/DECISIONS.md 2026-10-02): brugerens
// spørgsmål til højre med kategori, chatbottens svar til venstre.
export function ChatbotThreadMessages({ messages }: { messages: ThreadMessage[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {messages.map((message) =>
        message.role === "SYSTEM" ? (
          <li key={message.id} className="hf-type-small py-1 text-center text-text-muted">
            {message.body} · {formatAdminTime(message.createdAt)}
          </li>
        ) : (
          <li
            key={message.id}
            className={`flex max-w-[85%] flex-col gap-1 rounded-lg px-3 py-2 ${
              message.role === "USER" ? "ml-auto bg-hf-tan" : "mr-auto border border-hf-tan-dark bg-hf-white"
            }`}
          >
            <span className="hf-type-small text-text-muted">
              {message.role === "USER" ? "Bruger" : "Chatbot"} · {formatAdminTime(message.createdAt)}
              {message.role === "USER" && message.category && ` · ${chatbotCategoryLabel(message.category)}`}
              {message.role === "ASSISTANT" && message.needsHuman && " · foreslog medarbejder"}
            </span>
            <span className="hf-type-body whitespace-pre-wrap text-hf-black">{message.body}</span>
            {message.links.length > 0 && (
              <span className="hf-type-small text-text-secondary">Links: {message.links.join(", ")}</span>
            )}
          </li>
        ),
      )}
    </ol>
  );
}
