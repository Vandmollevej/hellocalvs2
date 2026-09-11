import Link from "next/link";

export function TopBar() {
  return (
    <div className="flex items-center justify-end px-4 pt-4">
      <Link
        href="/profile"
        aria-label="Åbn mine oplysninger"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan text-xs font-bold text-hf-black"
      >
        PT
      </Link>
    </div>
  );
}
