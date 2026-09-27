// Samme kalender-firkant som dagslisten i kalenderen: hvid firkant med dagens
// nummer — her med måneden under, da målsætninger ligger måneder fra hinanden.
// Grøn, når målsætningen er nået (som "i dag" i kalenderen).
export function GoalDateSquare({ date, completed = false }: { date: Date; completed?: boolean }) {
  return (
    <span
      className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border leading-none ${
        completed ? "border-hf-green bg-hf-green text-hf-white" : "border-hf-gray bg-hf-white text-hf-black"
      }`}
    >
      <span className="hf-type-body hf-type-strong">{date.getDate()}</span>
      <span className="text-text-secondary hf-type-micro hf-type-strong mt-0.5 uppercase">
        {date.toLocaleDateString("da-DK", { month: "short" }).replace(".", "")}
      </span>
    </span>
  );
}
