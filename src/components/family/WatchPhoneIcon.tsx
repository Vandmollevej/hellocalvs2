import { initialsOf } from "@/lib/initials";

// Blå smartphone med initialerne på den, der er på kontoen lige nu
// (docs/FAMILY.md). Hvid kant, så den står tydeligt på den grønne topbjælke.
export function WatchPhoneIcon({ name, title }: { name: string; title: string }) {
  return (
    <span role="img" aria-label={title} title={title} className="relative flex h-8 w-[22px] shrink-0">
      <svg viewBox="0 0 22 32" width="22" height="32" aria-hidden="true" className="absolute inset-0">
        <rect x="0.75" y="0.75" width="20.5" height="30.5" rx="4" fill="var(--hf-color-watch)" stroke="var(--hf-color-white)" strokeWidth="1.5" />
        <rect x="8" y="3.5" width="6" height="1.5" rx="0.75" fill="var(--hf-color-white)" />
      </svg>
      <span className="relative flex w-full items-center justify-center pt-[3px] text-[9px] font-bold leading-none text-hf-white">
        {initialsOf(name)}
      </span>
    </span>
  );
}
