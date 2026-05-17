import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { getConfig, setConfig } from "../bot/guild-config-store.js";
import { UpdateGuildConfigBody } from "@workspace/api-zod";

const router = Router();

// ── Auth middleware ──────────────────────────────────────────────────────────
const DASHBOARD_SECRET = process.env["DASHBOARD_PASSWORD"] ?? "";

function authMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query["token"] as string ?? "");
  if (!DASHBOARD_SECRET || token !== DASHBOARD_SECRET) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  next();
}

// ── POST /api/dashboard/auth ─────────────────────────────────────────────────
router.post("/dashboard/auth", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!DASHBOARD_SECRET || token !== DASHBOARD_SECRET) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true });
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
  const client = getClient();
  if (!client?.isReady()) {
    res.json([]);
    return;
  }
  const guilds = client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    iconURL: g.iconURL() ?? null,
    memberCount: g.memberCount,
  }));
  res.json(guilds);
});

// ── GET /api/dashboard/config/:guildId ──────────────────────────────────────
router.get("/dashboard/config/:guildId", authMiddleware, (req, res) => {
  const { guildId } = req.params as { guildId: string };
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
  setConfig(guildId, parsed.data);
  res.json(getConfig(guildId));
});

export default router;
