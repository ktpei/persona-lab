-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'PARSING', 'SIMULATING', 'AGGREGATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('SCREENSHOT', 'AGENT');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "RunMode" NOT NULL DEFAULT 'SCREENSHOT',
    "url" TEXT,
    "goal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frame" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "summary" TEXT,
    "parsedElements" JSONB,
    "parsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Frame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "knobs" JSONB,
    "traits" JSONB,
    "ageGroup" TEXT,
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "mode" "RunMode" NOT NULL DEFAULT 'SCREENSHOT',
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "reportJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunPersona" (
    "runId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,

    CONSTRAINT "RunPersona_pkey" PRIMARY KEY ("runId","personaId")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepTrace" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "frameId" TEXT,
    "screenshotPath" TEXT,
    "observation" JSONB NOT NULL,
    "reasoning" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "friction" DOUBLE PRECISION NOT NULL,
    "dropoffRisk" DOUBLE PRECISION NOT NULL,
    "memory" TEXT,

    CONSTRAINT "StepTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "frequency" INTEGER NOT NULL,
    "affectedPersonas" JSONB NOT NULL,
    "elementRef" TEXT,
    "stepIndex" INTEGER,
    "screenUrl" TEXT,
    "recommendedFix" TEXT,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Frame_flowId_stepIndex_key" ON "Frame"("flowId", "stepIndex");

-- CreateIndex
CREATE UNIQUE INDEX "StepTrace_episodeId_stepIndex_key" ON "StepTrace"("episodeId", "stepIndex");

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frame" ADD CONSTRAINT "Frame_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPersona" ADD CONSTRAINT "RunPersona_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPersona" ADD CONSTRAINT "RunPersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepTrace" ADD CONSTRAINT "StepTrace_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepTrace" ADD CONSTRAINT "StepTrace_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "Frame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
