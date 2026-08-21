import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireCommunityAuth() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gongbu_eong_session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:4000";

  const authenticated = await fetch(new URL("/api/auth/me", backendUrl), {
    headers: {
      Cookie: `gongbu_eong_session=${sessionCookie}`,
    },
    cache: "no-store",
  })
    .then(async (response) => {
      const body = await response.json() as { authenticated?: boolean };
      return response.ok && Boolean(body.authenticated);
    })
    .catch(() => false);

  if (!authenticated) {
    redirect("/login");
  }
}
