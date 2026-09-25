// Fælles sektion: én overskrift (.hf-type-section-title tegner selv sine
// streger — tilføj aldrig en ekstra skillelinje), indholdet og en valgfri grå
// forklaringsnote nederst (.hf-section-note). Brug denne i stedet for at bygge
// sektionsoverskrifter pr. side.
export function Section({
  title,
  note,
  children,
}: {
  title: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="hf-type-section-title">{title}</h2>
      {children}
      {note && <p className="hf-section-note">{note}</p>}
    </section>
  );
}
