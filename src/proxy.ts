import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh proxy: keeps the Supabase auth cookie alive on every request.
 * The refresh MUST be awaited, otherwise the rotated cookie is set after the response
 * has gone out and the session silently breaks ("Invalid Refresh Token").
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Anonymous visitors have no session to refresh: skip the round-trip.
  const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"));
  if (authCookies.length === 0) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    const { error } = await supabase.auth.getUser();
    // A dead session (e.g. the account was deleted): clear its cookies so it stops failing on every request.
    if (error && /refresh token|session.*(missing|not found)|user.*not found/i.test(error.message)) {
      response = NextResponse.next({ request });
      authCookies.forEach((c) => response.cookies.delete(c.name));
    }
  } catch {
    // Auth service unreachable: let the request through; pages handle a missing session.
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.png|apple-icon.png|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|icons/).*)"],
};
