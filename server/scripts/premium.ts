// Turns a Premium pack on or off for an account until the store purchase is wired up.
//   npm run premium -- someone@example.com budget 2027-12-31   (pack Budget until that day, included)
//   npm run premium -- someone@example.com menus 2027-12-31    (pack Menus)
//   npm run premium -- someone@example.com tout 2027-12-31     (« Les 2 »)
//   npm run premium -- someone@example.com tout off            (remove)
// Uses DATABASE_URL, so run it with the production URL to change a real account.
import { prisma } from "../src/db";

const PACKS = {
  budget: { fields: ["budgetUntil"], label: "pack Budget" },
  menus: { fields: ["mealsUntil"], label: "pack Menus" },
  tout: { fields: ["budgetUntil", "mealsUntil"], label: "les 2 packs" },
} as const;

async function main() {
  const [email, packArg, until] = process.argv.slice(2);
  const pack = PACKS[packArg as keyof typeof PACKS];
  if (!email || !pack || !until) {
    console.error("Usage : npm run premium -- <email> <budget | menus | tout> <AAAA-MM-JJ | off>");
    process.exit(1);
  }
  let date: Date | null = null;
  if (until !== "off") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Date attendue au format AAAA-MM-JJ");
    date = new Date(`${until}T23:59:59Z`);
  }
  const found = await prisma.user.findUnique({ where: { email } });
  if (!found) throw new Error(`Aucun compte avec l'email ${email}`);
  await prisma.user.update({ where: { id: found.id }, data: Object.fromEntries(pack.fields.map((f) => [f, date])) });
  console.log(date ? `${email} : ${pack.label} jusqu'au ${until}` : `${email} : ${pack.label} désactivé${pack.fields.length > 1 ? "s" : ""}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
