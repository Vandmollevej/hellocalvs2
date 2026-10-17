-- Robot-QoS (docs/DECISIONS.md 2026-10-17): et forfaldent robotjob venter,
-- mens serveren er for belastet eller i en spærretid. Hvorfor og siden hvornår
-- vises på admin → Robotter. Selve indstillingen ligger i robot_configs (key "qos").
ALTER TABLE "scheduled_jobs" ADD COLUMN "qosWaitingSince" TIMESTAMP(3);
ALTER TABLE "scheduled_jobs" ADD COLUMN "qosWaitReason" TEXT;
