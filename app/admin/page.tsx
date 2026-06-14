import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminPanelClient from "./AdminPanelClient";
import "./admin-panel.css";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../lib/oraculo-admin-auth";

export const metadata: Metadata = {
  title: "Panel Admin | Refugio Primitivo",
  description: "Panel admin RCON para Refugio Primitivo.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session.ok) redirect("/admin/login");

  return <AdminPanelClient />;
}
