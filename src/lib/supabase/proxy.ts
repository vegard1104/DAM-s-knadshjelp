import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Kjører på hver request for å:
 * 1. Refreshe Supabase-auth-cookies hvis de er i ferd med å utløpe
 * 2. Redirecte ikke-innloggede brukere til /login (unntatt selve login-siden)
 *
 * Hvis env vars mangler (f.eks. på første deploy før de er fylt inn i
 * Vercel) lar vi requesten passere uten auth-sjekk i stedet for å krasje.
 * Det gjør at innloggingssida fortsatt vises, og brukeren får en tydelig
 * feilmelding ved login-forsøk i stedet for et tomt 500/404-svar.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[proxy] Supabase env vars mangler — hopper over auth-sjekk. " +
        "Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i Vercel.",
    );
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    console.error("[proxy] Auth-sjekk feilet:", error);
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public");

  if (!user && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
