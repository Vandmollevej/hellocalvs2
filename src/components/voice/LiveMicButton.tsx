"use client";

function StandMicrophone() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <rect x="22" y="5" width="20" height="31" rx="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M15 27v2a17 17 0 0 0 34 0v-2M32 46v10M22 57h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 14h10M27 21h10M27 28h10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Den store mikrofon over søgefeltet på Madvarer (flettet med den gamle Tale-side 2026-10-16). */
export function LiveMicButton({
  listening,
  unsupported,
  label,
  onClick,
}: {
  listening: boolean;
  unsupported: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unsupported}
      aria-label={label}
      className="relative flex h-24 w-24 items-center justify-center disabled:cursor-default"
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-hf-green opacity-20 motion-reduce:animate-none" />}
      <span className={`relative flex h-20 w-20 items-center justify-center rounded-full text-hf-white shadow-sm ${unsupported ? "bg-hf-gray" : "bg-hf-green"}`}>
        <StandMicrophone />
      </span>
    </button>
  );
}
