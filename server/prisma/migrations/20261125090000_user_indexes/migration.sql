-- Audit (25/11/2026) : ces tables sont lues par famille (userId) sans index.
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");
CREATE INDEX "ExpenseCategory_userId_idx" ON "ExpenseCategory"("userId");
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "SharedPerson_userId_idx" ON "SharedPerson"("userId");
CREATE INDEX "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");
