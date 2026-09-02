import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";

// Rent visuelt forberedt liste — ingen sprog-/landevalgslogik endnu.
// Rækkefølgen følger de leverede flagbilleder i "Billeder til brug".
// "Danmark" er markeret som det valgte land, indtil rigtigt landevalg bygges.
const SELECTED_COUNTRY = "danmark";

const COUNTRIES = [
  { label: "Australien", flag: "australien" },
  { label: "Belgien", flag: "belgien" },
  { label: "Canada", flag: "canada" },
  { label: "Danmark", flag: "danmark" },
  { label: "Frankrig", flag: "frankrig" },
  { label: "Holland (engelsk)", flag: "holland-engelsk" },
  { label: "Irland", flag: "irland" },
  { label: "Italien", flag: "italien" },
  { label: "Luxembourg", flag: "luxembourg" },
  { label: "Nederlandene (hollandsk)", flag: "nederlandene" },
  { label: "New Zealand", flag: "new-zealand" },
  { label: "Norge", flag: "norge" },
  { label: "Schweiz", flag: "schweiz" },
  { label: "Spanien", flag: "spanien" },
  { label: "Storbritannien", flag: "storbritannien" },
  { label: "Sverige", flag: "sverige" },
  { label: "Tyskland", flag: "tyskland" },
  { label: "USA", flag: "usa" },
  { label: "Østrig", flag: "oestrig" },
];

export default function VaelgLandPage() {
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">Vælg dit land</h1>
        <div className="hf-appbar__slot">
          <Link href="/logind" aria-label="Tilbage" className="text-hf-white">
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
