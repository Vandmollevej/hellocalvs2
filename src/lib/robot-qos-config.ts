import { prisma } from "@/lib/prisma";
import { ROBOT_QOS_KEY, sanitizeRobotQosSettings, type RobotQosSettings } from "@/lib/robot-qos";

// Robot-QoS-indstillingen (robot_configs, key "qos"). Slået fra, til admin
// slår den til på admin → Robotter.
export type RobotQosConfig = { enabled: boolean; settings: RobotQosSettings };

export async function loadRobotQos(): Promise<RobotQosConfig> {
  const row = await prisma.robotConfig.findUnique({ where: { key: ROBOT_QOS_KEY } }).catch(() => null);
  return { enabled: row?.enabled ?? false, settings: sanitizeRobotQosSettings(row?.settings) };
}

export async function saveRobotQos(input: { enabled?: unknown; settings?: unknown }, adminId: string) {
  const current = await loadRobotQos();
  const enabled = typeof input.enabled === "boolean" ? input.enabled : current.enabled;
  const settings = input.settings === undefined ? current.settings : sanitizeRobotQosSettings(input.settings);
  await prisma.robotConfig.upsert({
    where: { key: ROBOT_QOS_KEY },
    create: { key: ROBOT_QOS_KEY, enabled, settings, updatedById: adminId },
    update: { enabled, settings, updatedById: adminId },
  });
  // Slået fra: ryd "venter"-markeringerne, så admin-siden ikke viser gamle grunde.
  if (!enabled) await prisma.scheduledJob.updateMany({ data: { qosWaitingSince: null, qosWaitReason: null } });
  return loadRobotQos();
}
