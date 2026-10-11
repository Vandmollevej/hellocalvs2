"use client";

import type { ImageCandidate, ImageGroup } from "@/lib/duplicate-review";
import type { ImageGroupView, ImageQuality } from "@/lib/image-quality";

// Én vare på admin "Dubletter" → Varebilleder (docs/DECISIONS.md 2026-09-28
// og 2026-10-11): billedet der vises i dag ved siden af ét alternativ (det
// anbefalede, hvis der er et), og de øvrige alternativer som miniaturer under
// — klik på en miniature bytter den ind som alternativ. Kun to handlinger:
// "Behold" og "Erstat med dette"; begge sletter de øvrige varianter. Klik på
// et billede åbner samme visning i lightboxen (DuplicateImageLightbox).

export function fileName(url: string) {
  const name = url.split("?")[0].split("/").pop() ?? url;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function metaLine(image: ImageCandidate, quality?: ImageQuality) {
  const size = !quality ? null : quality.ok ? `${quality.width} × ${quality.height}` : "Kan ikke indlæses";
  return [size, quality?.ok ? quality.format : null, ...image.tags.filter((t) => t !== "Import")]
    .filter(Boolean)
    .join(" · ");
}

type CardProps = {
  image: ImageCandidate;
  quality?: ImageQuality;
  kind: "current" | "alternative";
  recommended: boolean;
  busy: boolean;
  onAction: () => void;
  onOpen?: () => void;
  large?: boolean;
};

export function DuplicatePickCard({ image, quality, kind, recommended, busy, onAction, onOpen, large }: CardProps) {
  const frameClass = `hf-pick-frame ${recommended ? "is-recommended" : ""}`;
  const picture = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt="" />
  );
  return (
    <div className={`hf-pick-card ${large ? "is-large" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`hf-pick-badge ${kind === "current" ? "is-current" : ""}`}>
          {kind === "current" ? "Vises i dag" : "Alternativ"}
        </span>
        {recommended && <span className="hf-type-small hf-type-strong text-hf-green-dark">Anbefalet</span>}
      </div>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={`${frameClass} cursor-zoom-in`} aria-label="Vis i stor størrelse">
          {picture}
        </button>
      ) : (
        <div className={frameClass}>{picture}</div>
      )}
      <span className="hf-type-caption break-all text-hf-black">{fileName(image.url)}</span>
      <span className="hf-type-caption text-text-secondary">{metaLine(image, quality) || " "}</span>
      <button
        type="button"
        onClick={onAction}
        disabled={busy}
        className={`h-12 ${kind === "current" ? "hf-btn-secondary" : "hf-btn-primary"}`}
      >
        {kind === "current" ? "Behold" : "Erstat med dette"}
      </button>
    </div>
  );
}

type Props = {
  group: ImageGroup;
  view: ImageGroupView;
  quality: Record<string, ImageQuality | undefined>;
  busy: boolean;
  error?: string;
  onPick: (imageId: string) => void;
  onOpen: () => void;
  onResolve: (keepImageId: string) => void;
};

export function DuplicateImageGroup({ group, view, quality, busy, error, onPick, onOpen, onResolve }: Props) {
  const { current, alternatives, recommendedId, shown } = view;
  const others = alternatives.filter((img) => img.id !== shown?.id);

  return (
    <section className="hf-panel">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={`/admin/products/${group.productId}`}
          target="_blank"
          rel="noreferrer"
          className="hf-type-body hf-type-strong text-hf-black hover:underline"
        >
          {group.name}
        </a>
        {group.brand && <span className="hf-type-small text-hf-green-dark">{group.brand}</span>}
      </div>

      <div className="hf-pick-grid">
        <DuplicatePickCard
          image={current}
          quality={quality[current.url]}
          kind="current"
          recommended={false}
          busy={busy}
          onAction={() => onResolve(current.id)}
          onOpen={onOpen}
        />
        {shown && (
          <DuplicatePickCard
            image={shown}
            quality={quality[shown.url]}
            kind="alternative"
            recommended={shown.id === recommendedId}
            busy={busy}
            onAction={() => onResolve(shown.id)}
            onOpen={onOpen}
          />
        )}
      </div>

      {others.length > 0 && (
        <div className="hf-pick-strip" aria-label="Øvrige billeder">
          {others.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onPick(img.id)}
              aria-label={`Vis ${fileName(img.url)} som alternativ`}
              className={`hf-pick-thumb ${img.id === recommendedId ? "is-recommended" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      )}

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </section>
  );
}
