import { IconFlame, IconWalk, IconEgg } from "@tabler/icons-react";

type Stat = {
  icon: React.ReactNode;
  value: string;
  rotate: number;
};

const topStat: Stat = {
  icon: <IconWalk size={15} color="var(--hf-black)" />,
  value: "6.210",
  rotate: 3,
};
const bottomStat: Stat = {
  icon: <IconEgg size={15} color="var(--hf-black)" />,
  value: "88 g",
  rotate: -3,
};

export function StatsWheel() {
  return (
    <div
      className="absolute right-[30px] text-right"
      style={{ top: "50%", transform: "translateY(-50%)", maxWidth: 170 }}
    >
      <div
        className="flex items-center justify-end gap-1.5 opacity-60"
        style={{ transform: `rotate(${topStat.rotate}deg)`, transformOrigin: "right center" }}
      >
        {topStat.icon}
        <span className="text-sm text-hf-black">{topStat.value}</span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-end gap-2">
        <IconFlame size={20} color="var(--hf-green)" />
        <span className="text-[26px] font-extrabold leading-none text-hf-black">2.599</span>
      </div>
      <p className="mt-0.5 text-[13px] text-hf-black opacity-70">/ 3.299 kcal</p>

      <div
        className="mt-2 flex items-center justify-end gap-1.5 opacity-60"
        style={{ transform: `rotate(${bottomStat.rotate}deg)`, transformOrigin: "right center" }}
      >
        {bottomStat.icon}
        <span className="text-sm text-hf-black">{bottomStat.value}</span>
      </div>
    </div>
  );
}
