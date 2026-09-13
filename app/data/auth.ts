import type { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export interface User {
  id: number;
  email: string;
}
export class AuthStore {
  private attempts = new Map<string, { count: number; until: number }>();
  private checking = 0;
  constructor(private sqlite: DatabaseSync) {}
  throttled(email: string) {
    const a = this.attempts.get(email);
    return !!a && a.until > Date.now() && a.count >= 8;
  }
  async verify(email: string, password: string): Promise<User | null> {
    const key = email.trim().toLowerCase();
    if (this.throttled(key) || this.checking >= 8) return null;
    const now = Date.now();
    for (const [email, attempt] of this.attempts)
      if (attempt.until <= now) this.attempts.delete(email);
    if (!this.attempts.has(key) && this.attempts.size >= 1000) return null;
    const previous = this.attempts.get(key);
    this.attempts.set(key, {
      count: (previous?.count ?? 0) + 1,
      until: previous?.until ?? now + 15 * 60_000,
    });
    this.checking++;
    try {
      const row = this.sqlite
        .prepare(
          "SELECT id,email,password_hash FROM users WHERE lower(email)=?",
        )
        .get(key);
      const valid = await bcrypt.compare(
        password,
        (row?.password_hash as string) ??
          "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      );
      if (!row || !valid) return null;
      this.attempts.delete(key);
      return { id: Number(row.id), email: String(row.email) };
    } finally {
      this.checking--;
    }
  }
  createSession(userId: number) {
    const id = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    this.sqlite
      .prepare("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)")
      .run(id, userId, expiresAt.toISOString());
    return { id, expiresAt };
  }
  resolve(id: string): User | null {
    if (!id || id.length > 128) return null;
    const row = this.sqlite
      .prepare(
        "SELECT u.id,u.email,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?",
      )
      .get(id);
    if (!row || !(Date.parse(String(row.expires_at)) > Date.now())) return null;
    return { id: Number(row.id), email: String(row.email) };
  }
  revoke(id: string) {
    this.sqlite.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }
}
export function sessionId(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)tea-session=([^;]+)/)?.[1] ?? ""
  );
}
export function sessionCookie(request: Request, id: string, expiresAt: Date) {
  const url = new URL(request.url);
  const secure =
    url.protocol === "https:" ||
    (process.env.APP_ORIGIN?.startsWith("https:") &&
      url.host === new URL(process.env.APP_ORIGIN).host);
  return `tea-session=${id}; Path=/; HttpOnly; SameSite=Strict; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}
