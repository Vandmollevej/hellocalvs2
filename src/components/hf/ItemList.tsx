import type { ReactNode } from "react";

// Den ene fælles kortliste for varer/indtag (bruger 2026-10-17: "Dine
// indscanninger" er forbilledet). Tan kort med runde hjørner, rækkerne har
// 16 px gutter og en tan-dark linje imellem, og hver dato har en lille fed
// overskrift med streg under. Bruges af forsidens dagsliste, indscanninger,
// Vand, Indtast og tale-forslag. Swipe-rækker (SwipeableRow) har samme flade.
// Native: FoodListCard / FoodDayHeading / FoodListRows i FoodComponents.kt.

// `as="div"` når rækkerne ikke er <li> (fx ProductResultRow, der selv har linjen).
export function ItemListCard({
  children,
  className = "",
  as: Tag = "ul",
}: {
  children: ReactNode;
  className?: string;
  as?: "ul" | "div";
}) {
  return <Tag className={`overflow-hidden rounded-card bg-hf-tan ${className}`}>{children}</Tag>;
}

// Én række i kortet. Swipe-rækker sætter selv gutteren på den forreste flade,
// derfor `padded={false}` når barnet er en SwipeableRow.
export function ItemListRow({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <li className={`border-b border-hf-tan-dark last:border-b-0 ${padded ? "px-4" : ""}`}>{children}</li>;
}

export function ItemListDayHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="hf-type-small hf-type-strong border-b border-hf-tan-dark pb-1 text-hf-black first-letter:uppercase">
      {children}
    </h2>
  );
}

// Overskrift + kort for én dato (eller én gruppe).
export function ItemListSection({
  heading,
  children,
  as,
}: {
  heading: ReactNode;
  children: ReactNode;
  as?: "ul" | "div";
}) {
  return (
    <section className="flex flex-col gap-2">
      <ItemListDayHeading>{heading}</ItemListDayHeading>
      <ItemListCard as={as}>{children}</ItemListCard>
    </section>
  );
}
