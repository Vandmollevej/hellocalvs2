// Hello Doc-specific field style: a native <fieldset>/<legend> pair gives the
// bordered box with the label "cut into" the top border line, matching the
// HelloFresh checkout screenshot the user supplied as the direct visual
// reference for the invite/edit screens (docs/DECISIONS.md 2026-09-12) —
// deliberately not the general TextField/.hf-field contract, which this page
// was asked to depart from for this one flow.
export function NotchedTextField({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <fieldset className={`hd-notched-field ${className}`}>
      <legend>{label}</legend>
      <input {...props} />
    </fieldset>
  );
}
