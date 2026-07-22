import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Refresh the Supabase session cookie and gate the /admin area. Runs from the
 * root `proxy.ts` (Next.js 16's renamed Middleware). Token refresh here keeps
 * sessions from expiring mid-use; the redirect is an optimistic check —
 * `requireAdmin()` in the page/action is the authoritative guard.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() revalidates the token against Supabase — do not trust getSession()
  // alone for an auth decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Pages reachable without a session — the whole point of password recovery is
  // that the admin can't sign in yet. /admin/reset establishes the recovery
  // session itself before forwarding to the (gated) update-password page.
  const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset"];
  const isPublic = PUBLIC_ADMIN_PATHS.includes(pathname);
  const allowed = Boolean(user) && isAdminEmail(user?.email);

  // Unauthenticated / non-allowlisted visitor to a protected admin page.
  if (!isPublic && !allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Already-authenticated admin landing on the login page → dashboard.
  if (pathname === "/admin/login" && allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}
