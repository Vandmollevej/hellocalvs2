"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

export default function VelkommenPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-full flex-col items-center justify-center gap-8 bg-hf-green px-6">
        <Image src="/hello-cal-logo-white.png" alt="Hello Cal" width={280} height={90} priority />
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-hf-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="flex items-center bg-hf-green px-4 pb-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <Image src="/hello-cal-logo-white.png" alt="Hello Cal" width={130} height={42} priority />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="hf-type-body-sm flex items-center gap-1.5 font-semibold">
          <Image src="/flag-denmark.png" alt="" width={22} height={16} className="rounded-[2px]" />
          <span>DK</span>
          <HfChevron direction="down" compact className="text-hf-black opacity-60" />
        </div>

        <div className="mt-8 flex justify-center">
          <div className="hf-hero-circle h-[180px] w-[180px] rounded-full border-[3px] border-hf-green" />
        </div>

        <h1 className="hf-type-hero mt-8">
          Indblik i dine madvaner
          <br />
          <span className="text-hf-green">Hold dig sund med Hello Cal!</span>
        </h1>

        <p className="hf-type-body-lg mt-8">
          Den nemmeste app til at registrere og holde styr på dit kalorieindtag.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
        <Link
          href="/tilmeld"
          className="hf-btn-primary hf-type-button h-12 w-full"
        >
          Tilmeld dig
        </Link>
        <Link
          href="/logind"
          className="hf-btn-secondary hf-type-button h-12 w-full"
        >
          Log ind
        </Link>
      </div>
    </div>
  );
}
