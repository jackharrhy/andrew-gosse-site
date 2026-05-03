// scripts/tea-seed-users.ts
/**
 * Seed default admin users into TeaCMS.
 * Run from project root: npx tsx scripts/tea-seed-users.ts <email> <password> [<email2> <password2>]
 */
import { hashPassword, findUserByEmail, createUser } from "../src/tea/auth.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length % 2 !== 0) {
    console.error("Usage: tea-seed-users.ts <email> <password> [<email2> <password2>]");
    process.exit(1);
  }

  for (let i = 0; i < args.length; i += 2) {
    const email = args[i].toLowerCase();
    const password = args[i + 1];
    const existing = findUserByEmail(email);
    if (existing) {
      console.log(`✓ User ${email} already exists, skipping`);
      continue;
    }
    const hash = await hashPassword(password);
    const user = createUser(email, hash);
    console.log(`✓ Created user ${user.email} (id ${user.id})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
