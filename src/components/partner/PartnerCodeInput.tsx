"use client";

// Seks-cifret kodefelt til 2-faktor (samme udtryk som admin-formularerne).
export function PartnerCodeInput({ code, onChange }: { code: string; onChange: (value: string) => void }) {
  return (
    <label className="hf-type-body flex flex-col gap-1">
      Kode fra authenticator-appen
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        required
        value={code}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="hf-type-page-title hf-field rounded-md border border-hf-tan-dark bg-hf-white px-3 text-center tracking-[0.4em]"
      />
    </label>
  );
}
