import { IconCheck } from "@tabler/icons-react";

// Trin-overskriften øverst i kamerabilledet (docs/DECISIONS.md 2026-10-02,
// større og nummereret 2026-10-14): "1. Scan stregkode" stort; når et trin er
// klaret, står det senest klarede lille og overstreget med flueben lige over
// det nye trins overskrift (StepDoneOverlay flyver linjen derop).
export function ScanHeading({
  number,
  title,
  done,
  doneLabel,
}: {
  number: number;
  title: string;
  done: { number: number; title: string } | null;
  doneLabel: string | null;
}) {
  return (
    <div className="hf-scan-heading" aria-live="polite">
      {done && (
        <p className="hf-scan-heading__done" aria-label={doneLabel ?? undefined}>
          <span className="hf-scan-heading__done-text">
            {done.number}. {done.title}
          </span>
          <span className="hf-scan-heading__done-check" aria-hidden>
            <IconCheck size={12} stroke={3.5} />
          </span>
        </p>
      )}
      <p key={number} className="hf-scan-heading__title">
        {number}. {title}
      </p>
    </div>
  );
}
