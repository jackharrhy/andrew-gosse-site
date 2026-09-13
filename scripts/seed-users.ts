import { openDatabase } from "../app/data/database.ts";
import bcrypt from "bcryptjs";
const email = process.env.TEA_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.TEA_ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Set TEA_ADMIN_EMAIL and TEA_ADMIN_PASSWORD (at least 12 characters) in ignored configuration.",
  );
const { sqlite } = await openDatabase();
if (sqlite.prepare("SELECT id FROM users WHERE lower(email)=?").get(email))
  throw new Error(
    "User exists; this command never changes existing credentials.",
  );
sqlite
  .prepare("INSERT INTO users (email,password_hash) VALUES (?,?)")
  .run(email, await bcrypt.hash(password, 12));
sqlite.close();
console.log("Editor created.");
