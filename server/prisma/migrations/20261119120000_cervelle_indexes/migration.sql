-- Faster day-range reads of study sessions (stars, goals, weekly report, streaks)
CREATE INDEX "StudySession_learnerId_day_idx" ON "StudySession"("learnerId", "day");
CREATE INDEX "LearnerDevice_learnerId_idx" ON "LearnerDevice"("learnerId");
CREATE INDEX "LearnerCode_learnerId_idx" ON "LearnerCode"("learnerId");
