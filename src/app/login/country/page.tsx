import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";

// Purely visually prepared list — no language/country selection logic yet.
// The order follows the flag images supplied in "Billeder til brug".
// "Denmark" is marked as the selected country until real country selection is built.
const SELECTED_COUNTRY = "denmark";

const COUNTRIES = [
  { label: "Australien", flag: "australia" },
  { label: "Belgien", flag: "belgium" },
  { label: "Canada", flag: "canada" },
  { label: "Danmark", flag: "denmark" },
  { label: "Frankrig", flag: "france" },
  { label: "Holland (engelsk)", flag: "netherlands-english" },
  { label: "Irland", flag: "ireland" },
  { label: "Italien", flag: "italy" },
  { label: "Luxembourg", flag: "luxembourg" },
  { label: "Nederlandene (hollandsk)", flag: "netherlands" },
  { label: "New Zealand", flag: "new-zealand" },
  { label: "Norge", flag: "norway" },
  { label: "Schweiz", flag: "switzerland" },
  { label: "Spanien", flag: "spain" },
  { label: "Storbritannien", flag: "united-kingdom" },
  { label: "Sverige", flag: "sweden" },
  { label: "Tyskland", flag: "germany" },
  { label: "USA", flag: "usa" },
  { label: "Østrig", flag: "austria" },
];

export default function CountryPickerPage() {
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">Vælg dit land</h1>
        <div className="hf-appbar__slot">
          <Link href="/login" aria-label="Tilbage" className="text-hf-white">
            <IconArrowLeft size={24} />
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {COUNTRIES.map((country) => {
          const selected = country.flag === SELECTED_COUNTRY;
          return (
            <div
              key={country.flag}
              className="flex h-14 items-center gap-3 border-b border-hf-gray-border px-4"
            >
              <Image
                src={`/flags/${country.flag}.png`}
                alt=""
                width={36}
                height={27}
                className="rounded-[2px]"
              />
              <span className="hf-type-body flex-1">{country.label}</span>
              {selected && (
                <IconCheck size={20} stroke={2.5} className="text-hf-green" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
