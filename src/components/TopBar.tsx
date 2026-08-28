import Link from "next/link";

export function TopBar() {
  return (
    <div className="flex items-center justify-start px-5 pt-4">
      <Link
        href="/profil"
        aria-label="Åbn mine oplysninger"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-hf-tan text-sm font-bold text-hf-black"
      >
        PT
      </Link>
    </div>
  );
}
