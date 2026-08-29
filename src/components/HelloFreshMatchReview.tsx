"use client";

type MatchedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  servingSizeGrams: number | null;
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
        <p className="mb-3 text-xs text-hf-black opacity-70">Genkender retten...</p>
      )}

      {status === "found" && product && (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-hf-white/40">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-hf-black">{product.name}</p>
            <p className="text-xs text-hf-black opacity-60">
              {product.servingSizeGrams
                ? `${Math.round((product.kcalPer100g * product.servingSizeGrams) / 100)} kcal / portion`
                : `${Math.round(product.kcalPer100g)} kcal/100g`}
            </p>
          </div>
        </div>
      )}

      {status === "not_found" && (
        <p className="mb-3 text-xs font-semibold text-hf-black">
          Kunne ikke genkende retten. Prøv et andet billede, eller søg den manuelt under Madvarer.
        </p>
      )}

      {status === "failed" && (
        <p className="mb-3 text-xs font-semibold text-hf-black">Genkendelsen slog fejl. Prøv igen.</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onRetake} className="hf-btn-secondary flex-1 py-2.5 text-xs">
          Tag billedet om
        </button>
        {status === "found" && (
          <button type="button" onClick={onConfirm} className="hf-btn-primary flex-1 py-2.5 text-xs">
            Er det denne ret?
          </button>
        )}
      </div>
    </div>
  );
}
