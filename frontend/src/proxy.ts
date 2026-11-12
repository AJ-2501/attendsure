import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { signVerifiedUser, VERIFIED_USER_HEADER } from "@/lib/auth/verified-user";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Session refresh proxy: keeps the Supabase auth cookie alive on every request.
 * The refresh MUST be awaited, otherwise the rotated cookie is set after the response
 * has gone out and the session silently breaks ("Invalid Refresh Token").
 * The user verified here is forwarded (signed) so the render doesn't verify it a second time.
 */
export async function proxy(request: NextRequest) {
  // Supabase sends OAuth back to its Site URL root (not /auth/callback) when the requested
  // redirectTo isn't on its Redirect URLs allow-list. Finish the sign-in (or show its error)
  // instead of stranding the student on the landing page with an unused ?code=.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("error_description"))) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  // Never trust a client-supplied copy of the internal header.
  const forward = (user?: { id: string; email?: string | null }) => {
    const headers = new Headers(request.headers);
    headers.delete(VERIFIED_USER_HEADER);
    const signed = user && signVerifiedUser({ id: user.id, email: user.email ?? null });
    if (signed) headers.set(VERIFIED_USER_HEADER, signed);
    return NextResponse.next({ request: { headers } });
  };

  // Anonymous visitors have no session to refresh: skip the round-trip.
  const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"));
  if (authCookies.length === 0) return forward();

  let refreshed: CookieToSet[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        refreshed = list;
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    // A dead session (e.g. the account was deleted): clear its cookies so it stops failing on every request.
    if (error && /refresh token|session.*(missing|not found)|user.*not found/i.test(error.message)) {
      const response = forward();
      authCookies.forEach((c) => response.cookies.delete(c.name));
      return response;
    }
    const response = forward(data.user ?? undefined);
    refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch {
    // Auth service unreachable: let the request through; pages handle a missing session.
    const response = forward();
    refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png|apple-icon.png|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|icons/).*)"],
};
