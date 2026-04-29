import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import type { UserRole } from "@/types/database";

// Layoutet leser auth-cookie via Supabase, så det MÅ kjøre per request.
// Uten dette prøver Next.js å statisk prerendere ruter under build, og da
// feiler det fordi Supabase-env-vars typisk ikke er tilgjengelige der.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Hent profil for å få navn og rolle. Hvis profiles-tabellen ikke
  // eksisterer ennå (før første migrasjon er kjørt), faller vi tilbake
  // til e-post-baserte default-verdier slik at appen ikke krasjer.
  let navn = user.email?.split("@")[0] ?? "Bruker";
  let role: UserRole = "bruker";

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("navn, role")
      .eq("id", user.id)
      .single();

    if (profile) {
      navn = profile.navn || navn;
      role = profile.role as UserRole;
    }
  } catch {
    // Tabellen finnes ikke ennå — bruk default
  }

  const userInfo = {
    name: navn,
    email: user.email ?? "",
    role,
  };

  return (
    <div className="min-h-screen flex bg-bg-app">
      <Sidebar user={userInfo} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
