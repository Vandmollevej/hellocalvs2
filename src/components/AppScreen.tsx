import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export function AppScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="hf-screen-body">
      <TopBar />
      <div className="hf-screen-scroll--arc min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      <div className="sticky bottom-0 shrink-0">
        <BottomNav />
      </div>
    </div>
  );
}
