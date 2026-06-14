import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "../../oraculo-home.css";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../lib/oraculo-admin-auth";
import SkinsClient from "../../skins/SkinsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crear Skins | Refugio Primitivo",
  description: "Creador interno de skins de Refugio Primitivo.",
};

export default async function AdminSkinsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session.ok) redirect("/admin/login");

  return <SkinsClient />;
}
