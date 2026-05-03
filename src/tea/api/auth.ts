import {
  buildClearCookie,
  buildSessionCookie,
  createSession,
  deleteSession,
  findUserByEmail,
  getSessionIdFromRequest,
  validateSession,
  verifyPassword,
} from "../auth.js";

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export async function postLogin(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = createSession(user.id);
  return json(
    { user: { id: user.id, email: user.email, created_at: user.created_at } },
    {
      status: 200,
      headers: { "Set-Cookie": buildSessionCookie(session.id, session.expiresAt) },
    }
  );
}

export async function postLogout(request: Request): Promise<Response> {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) deleteSession(sessionId);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": buildClearCookie() },
  });
}

export function getMe(request: Request): Response {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return json({ error: "Unauthorized" }, { status: 401 });
  const user = validateSession(sessionId);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });
  return json({ user });
}
