-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TimerTrigger" AS ENUM ('MANUAL', 'LINKED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "TimerAppearance" AS ENUM ('COUNTDOWN', 'COUNT_UP', 'TIME_OF_DAY', 'COUNTDOWN_TOD', 'COUNT_UP_TOD', 'HIDDEN');

-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('VIEWER', 'AGENDA', 'MODERATOR', 'CONTROLLER', 'OPERATOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('MANUAL', 'AUDIENCE');

-- CreateEnum
CREATE TYPE "LogoMode" AS ENUM ('DEFAULT', 'HIDDEN', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Room',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "ownerId" TEXT,
    "teamId" TEXT,
    "apiKey" TEXT NOT NULL,
    "onAir" BOOLEAN NOT NULL DEFAULT false,
    "blackout" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "speaker" TEXT,
    "notes" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "displayMs" INTEGER,
    "startTime" TIMESTAMP(3),
    "triggerType" "TimerTrigger" NOT NULL DEFAULT 'MANUAL',
    "appearance" "TimerAppearance" NOT NULL DEFAULT 'COUNTDOWN',
    "wrapupYellowMs" INTEGER,
    "wrapupRedMs" INTEGER,
    "wrapupFlash" BOOLEAN NOT NULL DEFAULT false,
    "wrapupChime" TEXT,
    "labelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'white',
    "bold" BOOLEAN NOT NULL DEFAULT false,
    "uppercase" BOOLEAN NOT NULL DEFAULT false,
    "flash" BOOLEAN NOT NULL DEFAULT false,
    "focus" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" "MessageSource" NOT NULL DEFAULT 'MANUAL',
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Output" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OutputType" NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{}',
    "passwordHash" TEXT,
    "logoMode" "LogoMode" NOT NULL DEFAULT 'DEFAULT',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Output_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutputLink" (
    "id" TEXT NOT NULL,
    "outputId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "shortCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutputLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timerId" TEXT,
    "durationMs" INTEGER,
    "overUnderMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmitQuestionConfig" (
    "roomId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "closedMessage" TEXT,
    "logoUrl" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "questionLabel" TEXT,
    "nameLabel" TEXT,
    "hideName" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubmitQuestionConfig_pkey" PRIMARY KEY ("roomId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_apiKey_key" ON "Team"("apiKey");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_apiKey_key" ON "Room"("apiKey");

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");

-- CreateIndex
CREATE INDEX "Room_teamId_idx" ON "Room"("teamId");

-- CreateIndex
CREATE INDEX "Timer_roomId_order_idx" ON "Timer"("roomId", "order");

-- CreateIndex
CREATE INDEX "Message_roomId_order_idx" ON "Message"("roomId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Label_roomId_name_key" ON "Label"("roomId", "name");

-- CreateIndex
CREATE INDEX "Output_roomId_idx" ON "Output"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "OutputLink_signature_key" ON "OutputLink"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "OutputLink_shortCode_key" ON "OutputLink"("shortCode");

-- CreateIndex
CREATE INDEX "OutputLink_outputId_idx" ON "OutputLink"("outputId");

-- CreateIndex
CREATE INDEX "Log_roomId_createdAt_idx" ON "Log"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_roomId_createdAt_idx" ON "AnalyticsEvent"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_roomId_eventType_createdAt_idx" ON "AnalyticsEvent"("roomId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timer" ADD CONSTRAINT "Timer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Output" ADD CONSTRAINT "Output_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutputLink" ADD CONSTRAINT "OutputLink_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "Output"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmitQuestionConfig" ADD CONSTRAINT "SubmitQuestionConfig_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
