"use client";

type MatchedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  servingSizeGrams: number | null;
  servingSizeUnitSingular?: string | null;
};

type Status = "processing" | "found" | "not_found" | "failed";

type Props = {
  status: Status;
  product: MatchedProduct | null;
  onConfirm: () => void;
  onRetake: () => void;
};

export function HelloFreshMatchReview({ status, product, onConfirm, onRetake }: Props) {
  return (
    <div className="rounded-2xl bg-hf-tan p-4">
      {status === "processing" && (
        <p className="hf-type-small text-text-secondary mb-4">Genkender retten...</p>
      )}

      {status === "found" && product && (
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-hf-white/40">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="hf-type-body hf-type-strong truncate text-hf-black">{product.name}</p>
            <p className="hf-type-small text-text-secondary">
              {product.servingSizeGrams && product.servingSizeUnitSingular
                ? `${Math.round((product.kcalPer100g * product.servingSizeGrams) / 100)} kcal / ${product.servingSizeUnitSingular}`
                : `${Math.round(product.kcalPer100g)} kcal/100g`}
            </p>
          </div>
        </div>
      )}

      {status === "not_found" && (
        <p className="hf-type-small hf-type-strong mb-4 text-hf-black">
          Kunne ikke genkende retten. Prøv et andet billede, eller søg den manuelt under Madvarer.
        </p>
      )}

      {status === "failed" && (
        <p className="hf-type-small hf-type-strong mb-4 text-hf-black">Genkendelsen slog fejl. Prøv igen.</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onRetake} className="hf-btn-secondary flex-1 py-2.5">
          Tag billedet om
        </button>
        {status === "found" && (
          <button type="button" onClick={onConfirm} className="hf-btn-primary flex-1 py-2.5">
            Er det denne ret?
          </button>
        )}
      </div>
    </div>
  );
}
