import Link from "next/link";

export function TopBar() {
  return (
    <div data-top-bar className="flex items-center justify-end px-4 pt-4">
      <Link
        href="/profile"
        aria-label="Åbn mine oplysninger"
        className="hf-type-small hf-type-strong flex h-8 w-8 items-center justify-center rounded-full border border-hf-tan-dark bg-hf-tan text-hf-black"
      >
        PT
      </Link>
    </div>
  );
}
