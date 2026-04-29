import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

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

  // Vi henter rolle og fullt navn fra "profiles"-tabellen senere når vi
  // setter opp Supabase-skjemaet. For nå viser vi e-post som navn.
  const userInfo = {
    name: user.email?.split("@")[0] ?? "Bruker",
    email: user.email ?? "",
    role: "bruker", // midlertidig — kommer fra profiles-tabellen senere
  };

  return (
    <div className="min-h-screen flex bg-bg-app">
      <Sidebar user={userInfo} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
