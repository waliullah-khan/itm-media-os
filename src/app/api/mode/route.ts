import { MODE_COOKIE } from "@/lib/connections/mode";

/** Switch between the seeded demo board and the live board. */
export async function POST(req: Request) {
  let mode: string;
  try {
    const body = await req.json();
    mode = body.mode === "live" ? "live" : "seeded";
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const res = Response.json({ ok: true, mode });
  res.headers.set(
    "set-cookie",
    `${MODE_COOKIE}=${mode}; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
  );
  return res;
}
