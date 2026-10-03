import { STRIPE_MARKETS, type StripeCountry } from "@/lib/payments/stripe-markets";

// Betalingsmetoder for brugerens land (docs/DECISIONS.md 2026-09-29): DK =
// MobilePay, DE = kort og EC-kort. Vises på købssiden, så det er tydeligt,
// hvad man kan betale med. Chippen er den brunlige kortfarve
// (--hf-color-card), og logoernes SVG'er er beskåret til selve mærket, så de
// fylder chippen i stedet for at svømme i tom luft.
function TextBadge({ label }: { label: string }) {
  return (
    <span className="hf-type-small hf-type-strong flex h-10 items-center rounded-[8px] bg-hf-tan px-3">{label}</span>
  );
}

export function LogoBadge({ src, label, withName }: { src: string; label: string; withName?: boolean }) {
  return (
    <span className="flex h-10 items-center gap-2 rounded-[8px] bg-hf-tan px-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={withName ? "" : label} className="h-5 w-auto" />
      {withName && <span className="hf-type-small hf-type-strong">{label}</span>}
    </span>
  );
}

export function PaymentMethodBadges({ country }: { country: StripeCountry }) {
  if (!STRIPE_MARKETS[country]) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {country === "DK" ? (
        <LogoBadge src="/payment/mobilepay.svg" label="MobilePay" withName />
      ) : (
        <>
          <LogoBadge src="/payment/visa.svg" label="Visa" />
          <LogoBadge src="/payment/mastercard.svg" label="Mastercard" />
          <TextBadge label="EC-Karte" />
        </>
      )}
    </div>
  );
}
