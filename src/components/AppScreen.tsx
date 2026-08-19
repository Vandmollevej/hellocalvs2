import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export function AppScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-1">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
