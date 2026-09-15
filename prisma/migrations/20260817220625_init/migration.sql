-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "emailVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jwtJti" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProfile" (
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
    "professionalDomain" TEXT NOT NULL DEFAULT 'software_engineering',
    "jobRole" TEXT,
    "learningGoals" TEXT,
    "weeklyMinutesGoal" INTEGER NOT NULL DEFAULT 150,
    "uiLanguage" TEXT NOT NULL DEFAULT 'es-MX',
    "learningLanguage" TEXT NOT NULL DEFAULT 'en',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMxn" INTEGER NOT NULL,
    "priceUsdCents" INTEGER NOT NULL,
    "description" TEXT,
    "featuresJson" TEXT NOT NULL,
    "maxSessionsPerMonth" INTEGER NOT NULL DEFAULT 30,
    "maxDocuments" INTEGER NOT NULL DEFAULT 0,
    "ragEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "teamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adminEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cadence" TEXT NOT NULL DEFAULT 'monthly',
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "mercadoPagoSubscriptionId" TEXT,
    "mercadoPagoCustomerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amountMxnCents" INTEGER NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "provider" TEXT NOT NULL DEFAULT 'mercado_pago',
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "invoiceUrl" TEXT,
    "webhookReceivedAt" DATETIME,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'software_engineering',
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

-- CreateTable
CREATE TABLE "SessionMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costMxnCents" INTEGER NOT NULL DEFAULT 0,
    "ragContextJson" TEXT,
    "agentType" TEXT,
    "correctionsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "thetaBefore" REAL NOT NULL,
    "thetaAfter" REAL NOT NULL,
    "thetaSEAfter" REAL NOT NULL,
    "grammarScore" REAL,
    "vocabularyScore" REAL,
    "pronunciationScore" REAL,
    "fluencyScore" REAL,
    "coherenceScore" REAL,
    "errorsJson" TEXT,
    "summary" TEXT,
    "recommendation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "activeMinutes" INTEGER NOT NULL DEFAULT 0,
    "wordsPracticed" INTEGER NOT NULL DEFAULT 0,
    "newWordsLearned" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "correctionsApplied" INTEGER NOT NULL DEFAULT 0,
    "thetaStart" REAL,
    "thetaEnd" REAL,
    CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VocabularyItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "cefrLevel" TEXT,
    "stability" REAL NOT NULL DEFAULT 0.4,
    "difficulty" REAL NOT NULL DEFAULT 5.0,
    "retrievability" REAL NOT NULL DEFAULT 1.0,
    "lastReviewedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lapseCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'session',
    "sourceSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabularyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "vocabularyItemId" TEXT,
    "scheduledFor" DATETIME NOT NULL,
    "priority" REAL NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewSchedule_vocabularyItemId_fkey" FOREIGN KEY ("vocabularyItemId") REFERENCES "VocabularyItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "processedAt" DATETIME,
    "domain" TEXT,
    "language" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embeddingJson" TEXT,
    "embeddingModel" TEXT DEFAULT 'bge-m3-local',
    "domain" TEXT,
    "cefrLevel" TEXT,
    "section" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UserDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DomainContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cefrDefault" TEXT NOT NULL DEFAULT 'B1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VocabularyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "pos" TEXT,
    "phonetic" TEXT,
    "definitionEn" TEXT NOT NULL,
    "definitionEs" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "examplesJson" TEXT,
    "synonymsJson" TEXT,
    "antonymsJson" TEXT,
    "collocationsJson" TEXT,
    "embeddingJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabularyEntry_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DomainContent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GrammarRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "examplesJson" TEXT NOT NULL,
    "exceptionsJson" TEXT,
    "embeddingJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrammarRule_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DomainContent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "prompt" TEXT NOT NULL,
    "expectedAnswer" TEXT,
    "rubricJson" TEXT,
    "targetVocabJson" TEXT,
    "embeddingJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DomainContent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pitfall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "vocabEntryId" TEXT,
    "grammarRuleId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "correctForm" TEXT NOT NULL,
    "incorrectForm" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pitfall_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DomainContent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pitfall_vocabEntryId_fkey" FOREIGN KEY ("vocabEntryId") REFERENCES "VocabularyEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pitfall_grammarRuleId_fkey" FOREIGN KEY ("grammarRuleId") REFERENCES "GrammarRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorMessage" TEXT,
    "traceId" TEXT,
    "spanId" TEXT,
    "durationMs" INTEGER,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costMxnCents" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentRunId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "permission" TEXT,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "calledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentToolCall_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "producer" TEXT NOT NULL,
    "producerUserId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "consumer" TEXT,
    "consumerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemEvent_producerUserId_fkey" FOREIGN KEY ("producerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SystemEvent_consumerUserId_fkey" FOREIGN KEY ("consumerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeatureFlagAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "overrideReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeatureFlagAssignment_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureFlagAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "configJson" TEXT,
    CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExperimentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExperimentAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT,
    "tagsJson" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricPoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "statusCode" INTEGER,
    "requestUrl" TEXT,
    "requestMethod" TEXT,
    "requestId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "metadataJson" TEXT,
    "clusterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "resolvedAt" DATETIME,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingText" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "topic" TEXT NOT NULL DEFAULT 'general',
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "estimatedReadingTimeSec" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TypingText" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "topic" TEXT NOT NULL DEFAULT 'general',
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TypingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "typingTextId" TEXT,
    "wpm" REAL NOT NULL,
    "rawWpm" REAL NOT NULL,
    "accuracy" REAL NOT NULL,
    "consistency" REAL NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "correctedErrors" INTEGER NOT NULL,
    "uncorrectedErrors" INTEGER NOT NULL,
    "totalKeystrokes" INTEGER NOT NULL,
    "correctKeystrokes" INTEGER NOT NULL,
    "durationSec" REAL NOT NULL,
    "errorsJson" TEXT,
    "skillScore" REAL NOT NULL,
    "cefrLevel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TypingResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranslationExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceText" TEXT NOT NULL,
    "targetText" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'es',
    "targetLanguage" TEXT NOT NULL DEFAULT 'en',
    "cefrLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "topic" TEXT NOT NULL DEFAULT 'general',
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "vocabularyJson" TEXT,
    "hintsJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TranslationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "userTranslation" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetText" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "bleuScore" REAL NOT NULL,
    "levenshteinDist" INTEGER NOT NULL,
    "wordAccuracy" REAL NOT NULL,
    "semanticSimilarity" REAL NOT NULL,
    "grammarScore" REAL NOT NULL,
    "vocabularyScore" REAL NOT NULL,
    "overallScore" REAL NOT NULL,
    "errorsJson" TEXT,
    "matchedVocab" TEXT,
    "missedVocab" TEXT,
    "cefrLevel" TEXT,
    "durationSec" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranslationResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "cefrLevel" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "module" TEXT NOT NULL,
    "difficultyScore" REAL NOT NULL DEFAULT 0.5,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "prerequisitesJson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserTopicProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" REAL NOT NULL DEFAULT 0.0,
    "score" REAL,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserTopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CurriculumTopic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_jwtJti_key" ON "AuthSession"("jwtJti");

-- CreateIndex
CREATE INDEX "AuthSession_userId_createdAt_idx" ON "AuthSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_professionalDomain_idx" ON "UserProfile"("professionalDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "LearningSession_userId_startedAt_idx" ON "LearningSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "LearningSession_module_mode_idx" ON "LearningSession"("module", "mode");

-- CreateIndex
CREATE INDEX "LearningSession_status_idx" ON "LearningSession"("status");

-- CreateIndex
CREATE INDEX "SessionMessage_sessionId_createdAt_idx" ON "SessionMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionMessage_role_idx" ON "SessionMessage"("role");

-- CreateIndex
CREATE INDEX "SessionEvaluation_sessionId_idx" ON "SessionEvaluation"("sessionId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_date_idx" ON "UserProgress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_date_key" ON "UserProgress"("userId", "date");

-- CreateIndex
CREATE INDEX "VocabularyItem_userId_nextReviewAt_idx" ON "VocabularyItem"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "VocabularyItem_userId_domain_idx" ON "VocabularyItem"("userId", "domain");

-- CreateIndex
CREATE INDEX "ReviewSchedule_userId_scheduledFor_idx" ON "ReviewSchedule"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReviewSchedule_userId_completedAt_idx" ON "ReviewSchedule"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "UserDocument_userId_createdAt_idx" ON "UserDocument"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserDocument_contentHash_idx" ON "UserDocument"("contentHash");

-- CreateIndex
CREATE INDEX "UserDocument_status_idx" ON "UserDocument"("status");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_chunkIndex_idx" ON "DocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "DocumentChunk_domain_idx" ON "DocumentChunk"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "DomainContent_code_key" ON "DomainContent"("code");

-- CreateIndex
CREATE INDEX "VocabularyEntry_domainId_cefrLevel_idx" ON "VocabularyEntry"("domainId", "cefrLevel");

-- CreateIndex
CREATE INDEX "VocabularyEntry_term_idx" ON "VocabularyEntry"("term");

-- CreateIndex
CREATE INDEX "GrammarRule_domainId_cefrLevel_idx" ON "GrammarRule"("domainId", "cefrLevel");

-- CreateIndex
CREATE INDEX "Exercise_domainId_cefrLevel_type_idx" ON "Exercise"("domainId", "cefrLevel", "type");

-- CreateIndex
CREATE INDEX "Pitfall_domainId_type_idx" ON "Pitfall"("domainId", "type");

-- CreateIndex
CREATE INDEX "Pitfall_vocabEntryId_idx" ON "Pitfall"("vocabEntryId");

-- CreateIndex
CREATE INDEX "Pitfall_grammarRuleId_idx" ON "Pitfall"("grammarRuleId");

-- CreateIndex
CREATE INDEX "AgentMemory_agentType_userId_timestamp_idx" ON "AgentMemory"("agentType", "userId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentMemory_userId_timestamp_idx" ON "AgentMemory"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentRun_userId_startedAt_idx" ON "AgentRun"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_agentType_startedAt_idx" ON "AgentRun"("agentType", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentToolCall_agentRunId_calledAt_idx" ON "AgentToolCall"("agentRunId", "calledAt");

-- CreateIndex
CREATE INDEX "AgentToolCall_toolName_idx" ON "AgentToolCall"("toolName");

-- CreateIndex
CREATE INDEX "SystemEvent_name_createdAt_idx" ON "SystemEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_producer_createdAt_idx" ON "SystemEvent"("producer", "createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_consumer_status_idx" ON "SystemEvent"("consumer", "status");

-- CreateIndex
CREATE INDEX "SystemEvent_producerUserId_createdAt_idx" ON "SystemEvent"("producerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlagAssignment_userId_idx" ON "FeatureFlagAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagAssignment_flagId_userId_key" ON "FeatureFlagAssignment"("flagId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_key_key" ON "Experiment"("key");

-- CreateIndex
CREATE INDEX "ExperimentVariant_experimentId_idx" ON "ExperimentVariant"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentAssignment_userId_idx" ON "ExperimentAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentAssignment_experimentId_userId_key" ON "ExperimentAssignment"("experimentId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "MetricPoint_name_recordedAt_idx" ON "MetricPoint"("name", "recordedAt");

-- CreateIndex
CREATE INDEX "MetricPoint_userId_recordedAt_idx" ON "MetricPoint"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_fingerprint_createdAt_idx" ON "ErrorEvent"("fingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_status_createdAt_idx" ON "ErrorEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorEvent_clusterId_idx" ON "ErrorEvent"("clusterId");

-- CreateIndex
CREATE INDEX "ReadingText_cefrLevel_domain_idx" ON "ReadingText"("cefrLevel", "domain");

-- CreateIndex
CREATE INDEX "ReadingText_isActive_idx" ON "ReadingText"("isActive");

-- CreateIndex
CREATE INDEX "TypingText_cefrLevel_topic_idx" ON "TypingText"("cefrLevel", "topic");

-- CreateIndex
CREATE INDEX "TypingText_isActive_idx" ON "TypingText"("isActive");

-- CreateIndex
CREATE INDEX "TypingResult_userId_createdAt_idx" ON "TypingResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TypingResult_cefrLevel_idx" ON "TypingResult"("cefrLevel");

-- CreateIndex
CREATE INDEX "TranslationExercise_cefrLevel_sourceLanguage_targetLanguage_idx" ON "TranslationExercise"("cefrLevel", "sourceLanguage", "targetLanguage");

-- CreateIndex
CREATE INDEX "TranslationExercise_isActive_idx" ON "TranslationExercise"("isActive");

-- CreateIndex
CREATE INDEX "TranslationResult_userId_createdAt_idx" ON "TranslationResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationResult_exerciseId_idx" ON "TranslationResult"("exerciseId");

-- CreateIndex
CREATE INDEX "CurriculumTopic_skill_cefrLevel_order_idx" ON "CurriculumTopic"("skill", "cefrLevel", "order");

-- CreateIndex
CREATE INDEX "CurriculumTopic_isActive_idx" ON "CurriculumTopic"("isActive");

-- CreateIndex
CREATE INDEX "UserTopicProgress_userId_status_idx" ON "UserTopicProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicProgress_userId_topicId_key" ON "UserTopicProgress"("userId", "topicId");
