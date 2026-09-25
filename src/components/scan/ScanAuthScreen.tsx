import Image from "next/image";

// Login-/opsætningsskærme i Oprettelses-appen: samme brand-appbar og
// sidebaggrund som Hello Cals login, uden bundmenu.
export function ScanAuthScreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-cream">
      <div className="hf-appbar hf-appbar--brand">
        <div className="hf-appbar__slot" />
        <div className="flex min-w-0 items-center justify-center">
          <h1 className="hf-type-nav-title hf-appbar__title">{title}</h1>
        </div>
        <div className="hf-appbar__slot" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex justify-center py-4">
          <Image src="/hello-cal-logo.png" alt="Hello Cal" width={160} height={71} priority />
        </div>
        {children}
      </div>
    </div>
  );
}
