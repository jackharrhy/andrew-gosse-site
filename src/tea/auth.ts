import bcrypt from "bcryptjs";
import { ulid } from "ulid";
import { getDb } from "./db/client.js";

export const SESSION_COOKIE_NAME = "tea-session";
const SESSION_DURATION_DAYS = 30;

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 10);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function findUserByEmail(email: string): (User & { password_hash: string }) | null {
  const db = getDb();
  const row = db
    .prepare<[string], User & { password_hash: string }>(
      "SELECT id, email, password_hash, created_at FROM users WHERE email = ?"
    )
    .get(email);
  return row ?? null;
}

export function createUser(email: string, passwordHash: string): User {
  const db = getDb();
  const result = db
    .prepare<[string, string]>("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);
  return {
    id: Number(result.lastInsertRowid),
    email,
    created_at: new Date().toISOString(),
  };
}

export function createSession(userId: number): { id: string; expiresAt: Date } {
  const db = getDb();
  const id = ulid();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare<[string, number, string]>(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(id, userId, expiresAt.toISOString());
  return { id, expiresAt };
}

export function validateSession(sessionId: string): User | null {
  const db = getDb();
  const row = db
    .prepare<[string], { id: number; email: string; created_at: string; expires_at: string }>(
      `SELECT u.id, u.email, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    deleteSession(sessionId);
    return null;
  }
  return { id: row.id, email: row.email, created_at: row.created_at };
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare<[string]>("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function buildSessionCookie(sessionId: string, expiresAt: Date): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
