"use client";

import Image from "next/image";
import Link from "next/link";
import { HfChevron } from "@/components/hf/HfChevron";
import { SocialLoginButton } from "@/components/hf/SocialLoginButton";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

export default function LogIndPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="flex items-center justify-between bg-hf-green px-4 pb-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <Link href="/welcome" className="hf-type-body text-hf-white">
          {t("login.cancel")}
        </Link>
        <p className="hf-type-nav-title">
          {t("welcome.signUp")} <span className="opacity-80">/</span> {t("welcome.logIn")}
        </p>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5">
        <p className="hf-type-body-sm">{t("login.chooseCountry")}</p>
        <div className="mt-2 h-px bg-hf-gray-border" />
        <Link
          href="/login/country"
          className="flex h-12 items-center justify-between border-b border-hf-gray-border"
        >
          <div className="hf-type-body flex items-center gap-3">
            <Image src="/flag-denmark.png" alt="" width={22} height={16} className="rounded-[2px]" />
            <span>{t("login.country")}</span>
          </div>
          <HfChevron className="text-hf-gray" />
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          <SocialLoginButton provider="google" label={t("login.continueWithGoogle")} />
          <SocialLoginButton provider="apple" label={t("login.continueWithApple")} />
          <SocialLoginButton provider="facebook" label={t("login.continueWithFacebook")} />
        </div>

        <p className="hf-type-body-sm mt-4 text-center opacity-70">{t("common.or")}</p>

        <div className="mt-2">
          <TextField type="email" placeholder={t("login.emailPlaceholder")} />
        </div>
      </div>

      <div className="px-4 pb-8 pt-4">
        <button className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40" disabled>
          {t("login.continueButton")}
        </button>
      </div>
    </div>
  );
}
