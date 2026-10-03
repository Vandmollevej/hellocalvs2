"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconUpload } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";
import { readFrontPhoto } from "@/lib/product-capture";

// Webversionens afløser for "Tag billede" under Opret egen ret: en pc har
// sjældent et brugbart kamera, så man uploader eller trækker et billede af
// varens forside herind. Billedet læses lokalt (OCR) og slås op med samme
// genkendelse som kamera-flowet (/api/products/recognize-text); findes varen,
// går man direkte til den med retten som mål (?for=ret).
export function ProductPhotoDropZone({ returnSuffix }: { returnSuffix: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleFiles(files: FileList | File[] | null) {
    const file = files ? Array.from(files).find((candidate) => candidate.type.startsWith("image/")) : undefined;
    if (!file || working) return;
    setWorking(true);
    setNotFound(false);
    try {
      const photo = await fileToDownscaledDataUrl(file);
      const result = await readFrontPhoto(photo, ["dan", "eng"]);
      if (result.duplicateId) {
        router.push(`/add/${result.duplicateId}${returnSuffix}`);
        return;
      }
      setNotFound(true);
    } catch {
      setNotFound(true);
    }
    setWorking(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        disabled={working}
        aria-busy={working}
        className={`flex h-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-3 py-3 text-center transition-colors ${
          dragging ? "border-hf-green bg-hf-white" : "border-hf-tan-dark bg-hf-tan"
        } disabled:opacity-60`}
      >
        <IconUpload size={20} color="var(--hf-black)" />
        <span className="hf-type-small hf-type-strong text-hf-black">
          {working ? t("createDish.scanWebWorking") : t("createDish.scanWeb")}
        </span>
      </button>
      {notFound && <p className="hf-type-small text-text-secondary text-center">{t("createDish.scanWebNotFound")}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
