import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { getConfig, setConfig } from "../bot/guild-config-store.js";
import { UpdateGuildConfigBody } from "@workspace/api-zod";
import { getGuildLogs, getAllBotErrors, logConfigChange } from "../bot/event-log-store.js";
import { authMiddleware, type JwtPayload } from "../lib/jwt-auth.js";

const router = Router();

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
router.get("/dashboard/logs/:guildId", authMiddleware, (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner && !payload.guilds.some((g) => g.id === guildId)) {
    res.status(403).json({ error: "Accès refusé." });
    return;
  }
  const limit = Math.min(Number(req.query["limit"] ?? 100), 200);
  const type = req.query["type"] as string | undefined;
  let logs = getGuildLogs(guildId, limit);
  if (type) logs = logs.filter((l) => l.type === type);
  res.json(logs);
});

// ── GET /api/dashboard/errors ────────────────────────────────────────────────
router.get("/dashboard/errors", authMiddleware, (req, res) => {
  const payload: JwtPayload = (req as any).jwtPayload;
  if (!payload.isOwner) {
    res.status(403).json({ error: "Réservé au propriétaire." });
    return;
  }
  const limit = Math.min(Number(req.query["limit"] ?? 100), 100);
  res.json(getAllBotErrors(limit));
});

export default router;
