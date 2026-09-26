"use client";

import { useEffect, useState } from "react";
import { IconCarrot } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActionLink } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";

type PrivateIngredient = { id: string; name: string; requestId: string | null };

async function fetchIngredients(): Promise<PrivateIngredient[]> {
  const res = await fetch("/api/private-ingredients").catch(() => null);
  const data = res?.ok ? await res.json() : { ingredients: [] };
  return data.ingredients ?? [];
}

// "Mine ingredienser": brugerens egne, private ingredienser (docs/DECISIONS.md
// 2026-09-24). Når admin tilføjer en globalt, forsvinder den herfra og er
// erstattet af den globale — også i brugerens retter.
export default function PrivateIngredientsPage() {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<PrivateIngredient[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchIngredients().then((list) => {
      if (!cancelled) setIngredients(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    setIngredients(await fetchIngredients());
  }

  async function saveName(id: string) {
    if (!draftName.trim()) return;
    await fetch(`/api/private-ingredients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftName.trim() }),
    }).catch(() => null);
    setEditingId(null);
    await load();
  }

  async function remove(ingredient: PrivateIngredient) {
    if (!window.confirm(t("privateIngredients.deleteConfirm", { name: ingredient.name }))) return;
    await fetch(`/api/private-ingredients/${encodeURIComponent(ingredient.id)}`, { method: "DELETE" }).catch(
      () => null
    );
    await load();
  }

  return (
    <HfScreen title={t("privateIngredients.listTitle")} icon={<IconCarrot size={20} stroke={2} />}>
      <div className="hf-page">
        {ingredients !== null && ingredients.length === 0 && (
          <p className="hf-type-body text-text-secondary text-center">{t("privateIngredients.empty")}</p>
        )}
        {ingredients && ingredients.length > 0 && (
          <div className="overflow-hidden rounded-2xl bg-hf-tan">
            {ingredients.map((ingredient) => (
              <div key={ingredient.id} className="border-b border-hf-tan-dark px-4 py-3 last:border-b-0">
                {editingId === ingredient.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      maxLength={80}
                      aria-label={t("privateIngredients.nameLabel")}
                      className="hf-type-body min-w-0 flex-1 rounded-[8px] bg-hf-white px-3 py-2 text-hf-black outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveName(ingredient.id)}
                      className="hf-type-small hf-type-strong text-hf-black"
                    >
                      {t("privateIngredients.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="hf-type-small text-text-secondary"
                    >
                      {t("privateIngredients.cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="hf-type-body hf-type-strong text-hf-black">{ingredient.name}</p>
                      <p className="hf-type-small text-text-secondary">{t("privateIngredients.pending")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(ingredient.id);
                        setDraftName(ingredient.name);
                      }}
                      className="hf-btn-text text-hf-black"
                    >
                      {t("privateIngredients.rename")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(ingredient)}
                      className="hf-btn-text text-hf-red-dark"
                    >
                      {t("privateIngredients.delete")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <ActionLink href="/ingredients/new" className="hf-type-button h-12">
          {t("privateIngredients.createNew")}
        </ActionLink>
      </div>
    </HfScreen>
  );
}
