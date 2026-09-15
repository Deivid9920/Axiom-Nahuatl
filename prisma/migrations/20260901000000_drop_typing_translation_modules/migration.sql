-- AXIOM — Retirada de los módulos de mecanografía y traducción
--
-- La plataforma pasa a cubrir exclusivamente escucha y pronunciación.
-- Estas cuatro tablas quedaron sin código que las lea ni las escriba:
--   · TypingText           — contenido semilla, sin datos de usuario
--   · TypingResult         — HISTORIAL DE USUARIOS
--   · TranslationExercise  — contenido semilla, sin datos de usuario
--   · TranslationResult    — HISTORIAL DE USUARIOS
--
-- ⚠️  MIGRACIÓN DESTRUCTIVA — NO SE HA APLICADO.
--
--     Antes de ejecutarla en un entorno con datos reales:
--       1. Respalda la base de datos completa.
--       2. Exporta TypingResult y TranslationResult si el historial de
--          aprendizaje debe conservarse por retención o por obligación legal
--          (el derecho de acceso del usuario alcanza a estos registros).
--
--     Aplicar con:  bunx prisma migrate deploy
--
-- Nota: las reconstrucciones de LearningSession y UserProfile que aparecen más
-- abajo NO forman parte de este cambio de alcance. Son deriva acumulada entre
-- la migración inicial y el esquema actual, consecuencia de haber usado
-- `prisma db push` en desarrollo. Preservan los datos mediante INSERT ... SELECT.

-- DropIndex
DROP INDEX "TranslationExercise_isActive_idx";
-- DropIndex
DROP INDEX "TranslationExercise_cefrLevel_sourceLanguage_targetLanguage_idx";
-- DropIndex
DROP INDEX "TranslationResult_exerciseId_idx";
-- DropIndex
DROP INDEX "TranslationResult_userId_createdAt_idx";
-- DropIndex
DROP INDEX "TypingResult_cefrLevel_idx";
-- DropIndex
DROP INDEX "TypingResult_userId_createdAt_idx";
-- DropIndex
DROP INDEX "TypingText_isActive_idx";
-- DropIndex
DROP INDEX "TypingText_cefrLevel_topic_idx";
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TranslationExercise";
PRAGMA foreign_keys=on;
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TranslationResult";
PRAGMA foreign_keys=on;
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TypingResult";
PRAGMA foreign_keys=on;
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TypingText";
PRAGMA foreign_keys=on;
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'vida_cotidiana',
    "cefrTarget" TEXT,
    "scenarioTitle" TEXT,
    "scenarioConfig" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "durationSec" INTEGER,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costMxnCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "evaluationJson" TEXT,
    CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LearningSession" ("cefrTarget", "costMxnCents", "domain", "durationSec", "endedAt", "evaluationJson", "id", "messagesCount", "mode", "module", "scenarioConfig", "scenarioTitle", "startedAt", "status", "tokensIn", "tokensOut", "userId") SELECT "cefrTarget", "costMxnCents", "domain", "durationSec", "endedAt", "evaluationJson", "id", "messagesCount", "mode", "module", "scenarioConfig", "scenarioTitle", "startedAt", "status", "tokensIn", "tokensOut", "userId" FROM "LearningSession";
DROP TABLE "LearningSession";
ALTER TABLE "new_LearningSession" RENAME TO "LearningSession";
CREATE INDEX "LearningSession_userId_startedAt_idx" ON "LearningSession"("userId", "startedAt");
CREATE INDEX "LearningSession_module_mode_idx" ON "LearningSession"("module", "mode");
CREATE INDEX "LearningSession_status_idx" ON "LearningSession"("status");
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cefrInitial" TEXT NOT NULL DEFAULT 'A2',
    "cefrCurrent" TEXT NOT NULL DEFAULT 'A2',
    "theta" REAL NOT NULL DEFAULT -2.0,
    "thetaSE" REAL NOT NULL DEFAULT 1.0,
    "thetaUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skillReading" REAL NOT NULL DEFAULT 20.0,
    "skillWriting" REAL NOT NULL DEFAULT 20.0,
    "skillListening" REAL NOT NULL DEFAULT 20.0,
    "skillSpeaking" REAL NOT NULL DEFAULT 20.0,
    "skillsUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cefrReading" TEXT NOT NULL DEFAULT 'A2',
    "cefrWriting" TEXT NOT NULL DEFAULT 'A2',
    "cefrListening" TEXT NOT NULL DEFAULT 'A2',
    "cefrSpeaking" TEXT NOT NULL DEFAULT 'A2',
    "learningMode" TEXT NOT NULL DEFAULT 'moderado',
    "learningDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "learningTimeStart" TEXT NOT NULL DEFAULT '09:00',
    "learningTimeEnd" TEXT NOT NULL DEFAULT '10:00',
    "sessionDurationMin" INTEGER NOT NULL DEFAULT 25,
    "professionalDomain" TEXT NOT NULL DEFAULT 'vida_cotidiana',
    "jobRole" TEXT,
    "learningGoals" TEXT,
    "weeklyMinutesGoal" INTEGER NOT NULL DEFAULT 150,
    "uiLanguage" TEXT NOT NULL DEFAULT 'es-MX',
    "learningLanguage" TEXT NOT NULL DEFAULT 'nah',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("cefrCurrent", "cefrInitial", "cefrListening", "cefrReading", "cefrSpeaking", "cefrWriting", "createdAt", "darkMode", "id", "jobRole", "learningDays", "learningGoals", "learningLanguage", "learningMode", "learningTimeEnd", "learningTimeStart", "onboardedAt", "onboardingCompleted", "professionalDomain", "sessionDurationMin", "skillListening", "skillReading", "skillSpeaking", "skillWriting", "skillsUpdatedAt", "theta", "thetaSE", "thetaUpdatedAt", "uiLanguage", "updatedAt", "userId", "weeklyMinutesGoal") SELECT "cefrCurrent", "cefrInitial", "cefrListening", "cefrReading", "cefrSpeaking", "cefrWriting", "createdAt", "darkMode", "id", "jobRole", "learningDays", "learningGoals", "learningLanguage", "learningMode", "learningTimeEnd", "learningTimeStart", "onboardedAt", "onboardingCompleted", "professionalDomain", "sessionDurationMin", "skillListening", "skillReading", "skillSpeaking", "skillWriting", "skillsUpdatedAt", "theta", "thetaSE", "thetaUpdatedAt", "uiLanguage", "updatedAt", "userId", "weeklyMinutesGoal" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE INDEX "UserProfile_professionalDomain_idx" ON "UserProfile"("professionalDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
