"use client";

import { useState } from "react";
import { IconCheck, IconEye, IconEyeOff, IconX } from "@tabler/icons-react";
import { ADMIN_PASSWORD_RULES } from "@/lib/admin-password-policy";

type Props = {
  label: string;
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  // Efter et forsøg på at gå videre vises uopfyldte krav med rødt.
  showErrors?: boolean;
};

// Ny adgangskode + gentagelse med vis/skjul-øje og live-tjekliste over kravene.
export function AdminNewPasswordFields({ label, password, confirm, onPasswordChange, onConfirmChange, showErrors = false }: Props) {
  const [visible, setVisible] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;
  const inputClass = "hf-type-body hf-field w-full rounded-md border border-hf-tan-dark bg-hf-white pl-3 pr-11";

  function eyeButton() {
    return (
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Skjul adgangskode" : "Vis adgangskode"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted"
      >
        {visible ? <IconEyeOff size={20} aria-hidden /> : <IconEye size={20} aria-hidden />}
      </button>
    );
  }

  return (
    <>
      <label className="hf-type-body flex flex-col gap-1">
        {label}
        <span className="relative">
          <input
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={inputClass}
          />
          {eyeButton()}
        </span>
      </label>
      <ul className="hf-type-small flex flex-col gap-0.5">
        {ADMIN_PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={`flex items-center gap-1.5 ${ok ? "text-hf-green-dark" : showErrors ? "text-hf-red-dark" : "text-text-muted"}`}>
              {ok ? <IconCheck size={16} aria-hidden /> : <IconX size={16} aria-hidden />}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <label className="hf-type-body flex flex-col gap-1">
        Gentag adgangskode
        <span className="relative">
          <input
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            aria-invalid={mismatch}
            className={inputClass}
          />
          {eyeButton()}
        </span>
      </label>
      {mismatch && <p className="hf-type-small text-hf-red-dark">Adgangskoderne er ikke ens</p>}
    </>
  );
}
