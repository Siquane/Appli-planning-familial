import express from "express";
import cors from "cors";
import { env } from "./env";
import { authRouter } from "./routes/auth";
import { familyActivity } from "./lib/familyAlerts";
import { membersRouter } from "./routes/members";
import { tasksRouter } from "./routes/tasks";
import { constraintsRouter } from "./routes/constraints";
import { notificationsRouter } from "./routes/notifications";
import { shareRouter } from "./routes/share";
import { calendarRouter } from "./routes/calendar";
import { recipesRouter } from "./routes/recipes";
import { mealsRouter } from "./routes/meals";
import { shoppingRouter } from "./routes/shopping";
import { documentsRouter } from "./routes/documents";
import { expensesRouter } from "./routes/expenses";
import { expenseCategoriesRouter } from "./routes/expenseCategories";
import { categoryBudgetsRouter } from "./routes/categoryBudgets";
import { statementsRouter } from "./routes/statements";
import { familyRouter } from "./routes/family";
import { starsRouter } from "./routes/stars";
import { pocketMoneyRouter } from "./routes/pocketMoney";
import { notesRouter } from "./routes/notes";
import { recurringExpensesRouter } from "./routes/recurringExpenses";
import { savingsGoalsRouter } from "./routes/savingsGoals";
import { planRouter } from "./routes/plan";
import { billingRouter } from "./routes/billing";
import { cervelleRouter } from "./routes/cervelle";
import { grantLifetimePremium } from "./lib/lifetimePremium";

export const app = express();
// Render terminates HTTPS in front of the app: trust that one hop so
// req.ip (used by the auth rate limits) is the real client address.
app.set("trust proxy", 1);
app.use(cors());
// Cervelle receives course photos in the request body (base64): its own,
// larger limit, mounted before the global 100 kB JSON parser.
app.use("/cervelle", express.json({ limit: "40mb" }), cervelleRouter);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/members", membersRouter);
app.use("/tasks", familyActivity("planning", ["/auto-slot"]), tasksRouter);
app.use("/constraints", constraintsRouter);
app.use("/notifications", notificationsRouter);
app.use("/share", shareRouter);
app.use("/calendar", calendarRouter);
app.use("/recipes", familyActivity("recettes", ["/import"]), recipesRouter);
app.use("/meals", familyActivity("menu", ["/generate"]), mealsRouter);
app.use("/shopping", familyActivity("courses"), shoppingRouter);
app.use("/documents", documentsRouter);
app.use("/expenses", expensesRouter);
app.use("/expense-categories", expenseCategoriesRouter);
app.use("/category-budgets", categoryBudgetsRouter);
app.use("/recurring-expenses", recurringExpensesRouter);
app.use("/savings-goals", savingsGoalsRouter);
app.use("/statements", statementsRouter);
app.use("/family", familyRouter);
app.use("/stars", starsRouter);
app.use("/pocket-money", pocketMoneyRouter);
app.use("/notes", notesRouter);
app.use("/plan", planRouter);
app.use("/billing", billingRouter);

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur" });
});

if (require.main === module) {
  app.listen(env.port, () => console.log(`Passerelle API listening on :${env.port}`));
  grantLifetimePremium()
    .then((n) => n > 0 && console.log(`Premium à vie : ${n} compte(s)`))
    .catch((e) => console.error("Premium à vie non appliqué", e));
}
