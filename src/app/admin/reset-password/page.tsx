import { AdminResetPasswordForm } from "@/components/admin/AdminResetPasswordForm";

export default async function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AdminResetPasswordForm token={token ?? ""} />;
}
