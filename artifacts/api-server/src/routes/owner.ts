import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { authMiddleware, ownerMiddleware } from "../lib/jwt-auth.js";
import {
  ChannelType,
  PermissionsBitField,
  TextChannel,
  GuildMember,
} from "discord.js";

const router = Router();

router.use(authMiddleware);
router.use(ownerMiddleware);

// ── POST /api/owner/unlock ────────────────────────────────────────────────────
router.post("/owner/unlock", (req, res) => {
  const expected = process.env["OWNER_PASSWORD"];
  if (!expected) { res.status(500).json({ error: "OWNER_PASSWORD non configuré." }); return; }
  const given = String(req.body?.password ?? "");
  if (given !== expected) { res.status(401).json({ error: "Mot de passe incorrect." }); return; }
  res.json({ ok: true });
});

// ── GET /api/owner/guilds/:guildId/channels ──────────────────────────────────
router.get("/owner/guilds/:guildId/channels", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const channels = await guild.channels.fetch();
    const list = channels
      .filter((c) => c !== null)
      .map((c) => ({
        id: c!.id,
        name: c!.name,
        type: c!.type,
        parentId: "parentId" in c! ? (c as any).parentId : null,
        position: "position" in c! ? (c as any).position : 0,
      }))
      .sort((a, b) => a.position - b.position);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/owner/guilds/:guildId/roles ─────────────────────────────────────
router.get("/owner/guilds/:guildId/roles", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const roles = await guild.roles.fetch();
    const list = roles
      .filter((r) => !r.managed && r.id !== guild.id)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
      .sort((a, b) => b.position - a.position);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/owner/guilds/:guildId/members ───────────────────────────────────
router.get("/owner/guilds/:guildId/members", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  const search = (req.query["search"] as string ?? "").toLowerCase();
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

  try {
    let members: GuildMember[];
    if (search) {
      const fetched = await guild.members.search({ query: search, limit });
      members = [...fetched.values()];
    } else {
      await guild.members.fetch({ limit: 100 });
      members = [...guild.members.cache.values()].slice(0, limit);
    }

    const list = members.map((m) => ({
      id: m.id,
      tag: m.user.tag,
      displayName: m.displayName,
      avatarURL: m.user.displayAvatarURL({ size: 64 }),
      bot: m.user.bot,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      roles: m.roles.cache
        .filter((r) => r.id !== guild.id)
        .map((r) => r.name)
        .slice(0, 5),
    }));
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/owner/guilds/:guildId/send ─────────────────────────────────────
router.post("/owner/guilds/:guildId/send", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, content } = req.body as { channelId?: string; content?: string };
  if (!channelId || !content?.trim()) {
    res.status(400).json({ error: "channelId et content requis" });
    return;
  }

  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      res.status(400).json({ error: "Salon textuel introuvable" });
      return;
    }
    const msg = await channel.send(content.trim());
    res.json({ ok: true, messageId: msg.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/owner/guilds/:guildId/channels ─────────────────────────────────
router.post("/owner/guilds/:guildId/channels", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { name, type, parentId, topic } = req.body as {
    name?: string;
    type?: "text" | "voice" | "category" | "announcement" | "forum";
    parentId?: string;
    topic?: string;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name requis" }); return; }

  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  const typeMap: Record<string, ChannelType> = {
    text: ChannelType.GuildText,
    voice: ChannelType.GuildVoice,
    category: ChannelType.GuildCategory,
    announcement: ChannelType.GuildAnnouncement,
    forum: ChannelType.GuildForum,
  };
  const channelType = typeMap[type ?? "text"] ?? ChannelType.GuildText;

  try {
    const created = await guild.channels.create({
      name: name.trim(),
      type: channelType as any,
      parent: parentId || undefined,
      topic: topic?.trim() || undefined,
    });
    res.json({ ok: true, id: created.id, name: created.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/owner/guilds/:guildId/channels/:channelId ────────────────────
router.delete("/owner/guilds/:guildId/channels/:channelId", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel) { res.status(404).json({ error: "Salon introuvable" }); return; }
    await channel.delete("Supprimé via Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/owner/guilds/:guildId/members/:memberId/kick ───────────────────
router.post("/owner/guilds/:guildId/members/:memberId/kick", async (req, res) => {
  const { guildId, memberId } = req.params as { guildId: string; memberId: string };
  const { reason } = req.body as { reason?: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const member = await guild.members.fetch(memberId);
    await member.kick(reason?.trim() || "Expulsé via Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/owner/guilds/:guildId/members/:memberId/ban ────────────────────
router.post("/owner/guilds/:guildId/members/:memberId/ban", async (req, res) => {
  const { guildId, memberId } = req.params as { guildId: string; memberId: string };
  const { reason, deleteMessageDays } = req.body as { reason?: string; deleteMessageDays?: number };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    await guild.members.ban(memberId, {
      reason: reason?.trim() || "Banni via Dashboard Owner",
      deleteMessageSeconds: Math.min(deleteMessageDays ?? 0, 7) * 86400,
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/owner/guilds/:guildId/settings ─────────────────────────────────
router.patch("/owner/guilds/:guildId/settings", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { name, verificationLevel, systemChannelId } = req.body as {
    name?: string;
    verificationLevel?: 0 | 1 | 2 | 3 | 4;
    systemChannelId?: string | null;
  };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }

  try {
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      res.status(403).json({ error: "Permission ManageGuild manquante" });
      return;
    }
    await guild.edit({
      name: name?.trim() || guild.name,
      verificationLevel: verificationLevel ?? guild.verificationLevel,
      systemChannel: systemChannelId === null ? null : (systemChannelId || guild.systemChannelId || undefined),
    });
    res.json({ ok: true, name: guild.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Transcripts ───────────────────────────────────────────────────────────────
import { getTranscripts, getTranscriptById, deleteTranscript } from "../bot/transcript-db.js";

router.get("/owner/transcripts", async (req, res) => {
  try {
    const guildId = req.query["guildId"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const rows = await getTranscripts(guildId, limit);
    res.json(rows.map((r) => ({ ...r, content: undefined }))); // exclude content from list
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/owner/transcripts/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!id) { res.status(400).json({ error: "ID invalide" }); return; }
    const row = await getTranscriptById(id);
    if (!row) { res.status(404).json({ error: "Introuvable" }); return; }
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/transcripts/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!id) { res.status(400).json({ error: "ID invalide" }); return; }
    await deleteTranscript(id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Global Blacklist ──────────────────────────────────────────────────────────
import { getAllGlobalBlacklistedDB, addToGlobalBlacklistDB, removeFromGlobalBlacklistDB } from "../bot/global-blacklist-db.js";

router.get("/owner/blacklist", async (_req, res) => {
  try {
    const rows = await getAllGlobalBlacklistedDB();
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/blacklist", async (req, res) => {
  const { userId, userTag, reason, moderatorTag, moderatorId } = req.body ?? {};
  if (!userId || !userTag || !reason || !moderatorTag || !moderatorId) {
    res.status(400).json({ error: "Champs manquants" }); return;
  }
  try {
    await addToGlobalBlacklistDB({ userId, userTag, reason, moderatorTag, moderatorId });
    // Also ban from all guilds
    const client = getClient();
    if (client) {
      const banPromises = [...client.guilds.cache.values()].map((g) =>
        g.bans.create(userId, { reason: `[Blacklist globale] ${reason}` }).catch(() => null)
      );
      await Promise.allSettled(banPromises);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/blacklist/:userId", async (req, res) => {
  const { userId } = req.params as { userId: string };
  try {
    await removeFromGlobalBlacklistDB(userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Disabled Commands ─────────────────────────────────────────────────────────
import { getDisabledCommands, disableCommand, enableCommand, enableAllCommands } from "../bot/disabled-commands-db.js";

router.get("/owner/guilds/:guildId/disabled-commands", async (req, res) => {
  try {
    const rows = await getDisabledCommands(req.params["guildId"] as string);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/guilds/:guildId/disabled-commands", async (req, res) => {
  const guildId = req.params["guildId"] as string;
  const { commandName } = req.body ?? {};
  if (!commandName) { res.status(400).json({ error: "commandName manquant" }); return; }
  const payload = (req as any).jwtPayload as { userTag: string; userId: string };
  try {
    await disableCommand(guildId, commandName, payload.userTag, payload.userId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/guilds/:guildId/disabled-commands/:commandName", async (req, res) => {
  const { guildId, commandName } = req.params as { guildId: string; commandName: string };
  try {
    await enableCommand(guildId, commandName);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/guilds/:guildId/disabled-commands", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  try {
    await enableAllCommands(guildId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Captcha Logs ──────────────────────────────────────────────────────────────
import { getCaptchaLogs, deleteCaptchaLogs } from "../bot/captcha-log-db.js";

router.get("/owner/guilds/:guildId/captcha-logs", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const limit = Math.min(Number(req.query["limit"] ?? 200), 500);
  const event = req.query["event"] as string | undefined;
  try {
    const rows = await getCaptchaLogs({ guildId, limit, event: event || undefined });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/guilds/:guildId/captcha-logs", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  try {
    await deleteCaptchaLogs(guildId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Guild Settings (captcha, welcome, etc.) ──────────────────────────────────
import { getGuildSettings, upsertGuildSettings } from "../bot/guild-settings-db.js";

router.get("/owner/guilds/:guildId/settings", async (req, res) => {
  try {
    const settings = await getGuildSettings(req.params["guildId"] as string);
    res.json(settings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/owner/guilds/:guildId/settings", async (req, res) => {
  const guildId = req.params["guildId"] as string;
  const allowed = [
    "captchaEnabled", "captchaChannelId", "captchaRoleId", "captchaVerifiedRoleId",
    "captchaTimeoutMins", "captchaMaxAttempts", "captchaMode",
    "customPrefix", "welcomeEnabled", "welcomeChannelId", "welcomeMessage",
  ] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body && key in req.body) data[key] = req.body[key];
  }
  try {
    const updated = await upsertGuildSettings(guildId, data as any);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
