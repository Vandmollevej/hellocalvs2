-- Søvnspørgsmålet: frekvens og "Vis i kalenderen" (Profil → Screeninger → Søvn).
ALTER TABLE "users" ADD COLUMN "sleepQualityFrequency" TEXT NOT NULL DEFAULT 'DAILY';
ALTER TABLE "users" ADD COLUMN "sleepQualityShowInCalendar" BOOLEAN NOT NULL DEFAULT true;
