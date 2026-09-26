type Sex = "FEMALE" | "MALE" | null;

// Krops-ikonet: brugerens egen tegning (taljemål), valgt efter profilens køn.
// Tegnet som CSS-maske, så det får tekstfarven ligesom de andre ikoner.
export function IconBody({ size = 24, sex }: { size?: number; sex: Sex }) {
  const mask = `url(/body-measurements/${sex === "FEMALE" ? "female" : "male"}-waist.png) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: "currentColor",
        mask,
        WebkitMask: mask,
      }}
    />
  );
}
