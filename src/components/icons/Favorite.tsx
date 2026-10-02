import type { ComponentProps } from "react";
import type { Icon } from "@tabler/icons-react";

/**
 * Favorit-ikon (bogmærke med v-hak), tegnet efter brugerens godkendte artwork
 * (public/icons/favorite.png — outline, og favorite-filled.png — samme
 * silhuet udfyldt til den gemte tilstand). Rendereres som CSS-maske, så den
 * følger `color` / `currentColor` ligesom tabler-ikonerne ved siden af.
 * `stroke` accepteres for API-kompatibilitet og ignoreres.
 */
function FavoriteMask({
  src,
  size = 24,
  color = "currentColor",
  className,
  style,
}: ComponentProps<Icon> & { src: string }) {
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: color,
        mask,
        WebkitMask: mask,
        ...style,
      }}
    />
  );
}

export function IconFavorite(props: ComponentProps<Icon>) {
  return <FavoriteMask {...props} src="/icons/favorite.png" />;
}

export function IconFavoriteFilled(props: ComponentProps<Icon>) {
  return <FavoriteMask {...props} src="/icons/favorite-filled.png" />;
}
