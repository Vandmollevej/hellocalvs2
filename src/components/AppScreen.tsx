import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export function AppScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-1">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div className="sticky bottom-0 shrink-0">
        <BottomNav />
      </div>
    </div>
  );
}
