import { redirect } from "next/navigation";

// Admin → Retter har ingen egen forside; første underpunkt åbnes.
export default function AdminDishesPage() {
  redirect("/admin/dishes/user");
}