"use client";

import Link from "next/link";
import { useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

type ErrorField = "currentPassword" | "newPassword" | "confirmPassword" | "form";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="hf-type-caption text-hf-red-dark">
      {message}
    </p>
  );
}

export function ChangePasswordForm({ loggedIn }: { loggedIn: boolean }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<{ field: ErrorField; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function errorFor(field: ErrorField) {
    return error?.field === field ? error.message : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError({ field: "form", message: t("profile.changePassword.requiredError") });
      return;
    }
    if (newPassword.length < 8) {
      setError({ field: "newPassword", message: t("profile.changePassword.tooShortError") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ field: "confirmPassword", message: t("profile.changePassword.mismatchError") });
      return;
    }
    if (currentPassword === newPassword) {
      setError({ field: "newPassword", message: t("profile.changePassword.sameError") });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { message?: string; field?: ErrorField };
      if (!response.ok) {
        setError({
          field: data.field ?? "form",
          message: data.message ?? t("profile.changePassword.genericError"),
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError({ field: "form", message: t("profile.changePassword.networkError") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <HfScreen title={t("profile.changePassword.title")}>
      {!loggedIn ? (
        <div className="flex flex-col gap-4 p-4">
          <p className="hf-type-body">{t("profile.changePassword.loginRequired")}</p>
          <Link
            href="/login?next=/profile/change-password"
            className="hf-btn-primary h-12 w-full px-4"
          >
            {t("profile.changePassword.logIn")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4">
          <TextField
            id="currentPassword"
            name="currentPassword"
            label={t("profile.changePassword.currentLabel")}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={error?.field === "currentPassword"}
          />
          <FieldError message={errorFor("currentPassword")} />

          <TextField
            id="newPassword"
            name="newPassword"
            label={t("profile.changePassword.newLabel")}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-invalid={error?.field === "newPassword"}
          />
          <FieldError message={errorFor("newPassword")} />

          <TextField
            id="confirmPassword"
            name="confirmPassword"
            label={t("profile.changePassword.confirmLabel")}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={error?.field === "confirmPassword"}
          />
          <FieldError message={errorFor("confirmPassword")} />

          <FieldError message={errorFor("form")} />
          {success && (
            <p role="status" className="hf-type-caption text-hf-green-dark">
              {t("profile.changePassword.success")}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="hf-btn-primary mt-4 h-12 w-full px-4 disabled:opacity-50"
          >
            {submitting ? t("profile.changePassword.submitting") : t("profile.changePassword.submit")}
          </button>
        </form>
      )}
    </HfScreen>
  );
}
