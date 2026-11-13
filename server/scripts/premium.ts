// Turns Premium on or off for an account until the store purchase is wired up.
//   npm run premium -- someone@example.com 2027-12-31   (Premium until that day, included)
//   npm run premium -- someone@example.com off
// Uses DATABASE_URL, so run it with the production URL to change a real account.
import { prisma } from "../src/db";

async function main() {
  const [email, until] = process.argv.slice(2);
  if (!email || !until) {
    console.error("Usage : npm run premium -- <email> <AAAA-MM-JJ | off>");
    process.exit(1);
  }
  let premiumUntil: Date | null = null;
  if (until !== "off") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Date attendue au format AAAA-MM-JJ");
    premiumUntil = new Date(`${until}T23:59:59Z`);
  }
  const found = await prisma.user.findUnique({ where: { email } });
  if (!found) throw new Error(`Aucun compte avec l'email ${email}`);
  const user = await prisma.user.update({ where: { id: found.id }, data: { premiumUntil } });
  console.log(premiumUntil ? `${user.email} : Premium jusqu'au ${until}` : `${user.email} : Premium désactivé`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
