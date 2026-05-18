import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { getConfig, setConfig } from "../bot/guild-config-store.js";
import { UpdateGuildConfigBody } from "@workspace/api-zod";
import { getGuildLogs, getAllBotErrors, logConfigChange } from "../bot/event-log-store.js";
import { getAllWarningsForGuild } from "../bot/warnings-store.js";
import { getAllTempBansForGuild, countAllActiveTempBans } from "../bot/tempban-store.js";
import { getQuarantineList } from "../bot/quarantine-store.js";
import { countAllCustomCommands, getCustomCommands } from "../bot/custom-commands-store.js";
import { isMaintenanceMode, getMaintenanceMessage } from "../bot/maintenance-store.js";
import { getNotes } from "../bot/notes-store.js";
import { authMiddleware, type JwtPayload } from "../lib/jwt-auth.js";
import { notifyActionDM } from "../bot/dm-notify.js";

const router = Router();

// ── DM notification pour toutes les actions mutantes du dashboard ─────────────
router.use((req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const client = getClient();
    if (client?.isReady()) {
      notifyActionDM(client, req.method, req.path, req.body).catch(() => null);
    }
  }
  next();
});

// ── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get("/dashboard/stats", authMiddleware, (req, res) => {
  const client = getClient();
  if (!client?.isReady()) {
    res.json({
      tag: "N/A",
      guildCount: 0,
      userCount: 0,
      uptimeSeconds: process.uptime(),
      memoryMB: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
      wsPing: -1,
      online: false,
    });
    return;
  }
  const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  res.json({
    tag: client.user.tag,
    guildCount: client.guilds.cache.size,
    userCount,
    uptimeSeconds: client.uptime ? client.uptime / 1000 : process.uptime(),
    memoryMB: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
    wsPing: client.ws.ping,
    online: true,
  });
});

// ── GET /api/dashboard/guilds ────────────────────────────────────────────────
router.get("/dashboard/guilds", authMiddleware, (req, res) => {
  const payload: JwtPayload = (req as any).jwtPayload;
  const client = getClient();

  // Return guilds from JWT (already filtered: admin + bot present)
  const guilds = payload.guilds.map((g) => {
    const botGuild = client?.guilds.cache.get(g.id);
    return {
      id: g.id,
      name: g.name,
      iconURL: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
      memberCount: botGuild?.memberCount ?? 0,
    };
  });
  res.json(guilds);
});

// ── GET /api/dashboard/config/:guildId ──────────────────────────────────────
router.get("/dashboard/config/:guildId", authMiddleware, (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload: JwtPayload = (req as any).jwtPayload;
  // Ensure user has access to this guild
  if (!payload.isOwner && !payload.guilds.some((g) => g.id === guildId)) {
    res.status(403).json({ error: "Accès refusé à ce serveur." });
    return;
  }
  const client = getClient();
  if (client?.isReady() && !client.guilds.cache.has(guildId)) {
    res.status(404).json({ error: "Serveur introuvable" });
    return;
  }
  res.json(getConfig(guildId));
});

// ── PATCH /api/dashboard/config/:guildId ────────────────────────────────────
router.patch("/dashboard/config/:guildId", authMiddleware, (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner && !payload.guilds.some((g) => g.id === guildId)) {
    res.status(403).json({ error: "Accès refusé à ce serveur." });
    return;
  }
  const client = getClient();
  if (client?.isReady() && !client.guilds.cache.has(guildId)) {
    res.status(404).json({ error: "Serveur introuvable" });
    return;
  }
  const parsed = UpdateGuildConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.issues });
    return;
  }
  const before = getConfig(guildId);
  setConfig(guildId, parsed.data);
  const after = getConfig(guildId);
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    const oldVal = (before as unknown as Record<string, unknown>)[key];
    const newVal = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      logConfigChange(guildId, key, oldVal, newVal, payload.userTag);
    }
  }
  res.json(after);
});

// ── GET /api/dashboard/logs/:guildId ────────────────────────────────────────
router.get("/dashboard/logs/:guildId", authMiddleware, async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner && !payload.guilds.some((g) => g.id === guildId)) {
    res.status(403).json({ error: "Accès refusé." });
    return;
  }
  const limit = Math.min(Number(req.query["limit"] ?? 100), 200);
  const type = req.query["type"] as string | undefined;
  let logs = await getGuildLogs(guildId, limit);
  if (type) logs = logs.filter((l) => l.type === type);
  res.json(logs);
});

// ── GET /api/dashboard/errors ────────────────────────────────────────────────
router.get("/dashboard/errors", authMiddleware, async (req, res) => {
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner) {
    res.status(403).json({ error: "Réservé au propriétaire." });
    return;
  }
  const limit = Math.min(Number(req.query["limit"] ?? 100), 100);
  res.json(await getAllBotErrors(limit));
});

// ── GET /api/dashboard/activity-stats ────────────────────────────────────────
router.get("/dashboard/activity-stats", authMiddleware, (req, res) => {
  const client = getClient();
  if (!client?.isReady()) {
    res.json({ totalWarns: 0, activeTempBans: 0, activeQuarantines: 0, customCommands: 0, maintenanceServers: 0 });
    return;
  }
  let totalWarns = 0;
  let activeQuarantines = 0;
  let maintenanceServers = 0;
  for (const guild of client.guilds.cache.values()) {
    totalWarns += getAllWarningsForGuild(guild.id).reduce((s, u) => s + u.warnings.length, 0);
    activeQuarantines += getQuarantineList(guild.id).length;
    if (isMaintenanceMode(guild.id)) maintenanceServers++;
  }
  res.json({
    totalWarns,
    activeTempBans: countAllActiveTempBans(),
    activeQuarantines,
    customCommands: countAllCustomCommands(),
    maintenanceServers,
  });
});

// ── GET /api/dashboard/guilds/:guildId/stats ─────────────────────────────────
router.get("/dashboard/guilds/:guildId/stats", authMiddleware, async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner && !payload.guilds.some((g) => g.id === guildId)) {
    res.status(403).json({ error: "Accès refusé" }); return;
  }
  const warns = getAllWarningsForGuild(guildId);
  const totalWarns = warns.reduce((s, u) => s + u.warnings.length, 0);
  const topWarnedUsers = [...warns].sort((a, b) => b.warnings.length - a.warnings.length).slice(0, 5);
  const tempbans = getAllTempBansForGuild(guildId);
  const quarantines = getQuarantineList(guildId);
  const customCmds = getCustomCommands(guildId);
  type RecentLog = Awaited<ReturnType<typeof getGuildLogs>>[number];
  const recentLogs: RecentLog[] = await getGuildLogs(guildId, 30).catch(() => []);
  const commandStats = recentLogs.filter((l) => l.type === "command_exec").reduce((acc: Record<string, number>, l: RecentLog) => {
    const cmd = l.command ?? "?";
    acc[cmd] = (acc[cmd] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCommands = Object.entries(commandStats).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  res.json({
    totalWarns,
    topWarnedUsers: topWarnedUsers.map((u) => ({ userId: u.userId, count: u.warnings.length })),
    activeTempBans: tempbans.length,
    activeQuarantines: quarantines.length,
    customCommands: customCmds.length,
    maintenanceActive: isMaintenanceMode(guildId),
    maintenanceMessage: isMaintenanceMode(guildId) ? getMaintenanceMessage(guildId) : null,
    topCommands,
    recentEvents: recentLogs.slice(0, 15),
  });
});

export default router;
