import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 erstattet "middleware" med "proxy". Funksjonen kjører på hver
 * request — vi bruker den til å holde Supabase-auth-cookies friske og
 * redirecte ulogget bruker til /login.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
