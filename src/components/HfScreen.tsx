import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { BottomNav } from "@/components/BottomNav";

export function HfScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title={title} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
