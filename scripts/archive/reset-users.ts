import { PrismaClient } from "@prisma/client";

// One-off script: existing users created before password hashing was added
// have passwordHash = null and can't sign in. Decide per environment whether
// to delete them or assign a temporary password (which they must rotate).

const TEMP_PASSWORD = process.env.RESET_TEMP_PASSWORD;
const MODE = (process.env.RESET_MODE ?? "list") as "list" | "delete" | "set-temp";

async function main() {
  const prisma = new PrismaClient();
  const orphan = await prisma.user.findMany({
    where: { passwordHash: null },
    select: { id: true, email: true, createdAt: true },
  });

  if (orphan.length === 0) {
    console.log("No users without passwordHash. Nothing to do.");
    return;
  }

  console.log(`Found ${orphan.length} user(s) without passwordHash:`);
  for (const u of orphan) console.log(`  - ${u.email} (id=${u.id}, created=${u.createdAt.toISOString()})`);

  if (MODE === "list") {
    console.log("\nRe-run with RESET_MODE=delete or RESET_MODE=set-temp to take action.");
    return;
  }

  if (MODE === "delete") {
    const result = await prisma.user.deleteMany({ where: { passwordHash: null } });
    console.log(`\nDeleted ${result.count} user(s).`);
    return;
  }

  if (MODE === "set-temp") {
    if (!TEMP_PASSWORD) throw new Error("Set RESET_TEMP_PASSWORD env var (>= 8 chars) when RESET_MODE=set-temp");
    if (TEMP_PASSWORD.length < 8) throw new Error("RESET_TEMP_PASSWORD must be at least 8 characters");
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(TEMP_PASSWORD, 12);
    const result = await prisma.user.updateMany({
      where: { passwordHash: null },
      data: { passwordHash: hash },
    });
    console.log(`\nAssigned temporary password to ${result.count} user(s). Communicate it out-of-band and require rotation.`);
    return;
  }

  throw new Error(`Unknown RESET_MODE: ${MODE}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
