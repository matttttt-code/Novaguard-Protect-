import { Router } from "express";
import { getClient } from "../bot/client-store.js";
import { authMiddleware, ownerMiddleware } from "../lib/jwt-auth.js";
import {
  ChannelType,
  PermissionsBitField,
  TextChannel,
  GuildMember,
  WebhookClient,
  EmbedBuilder,
  ActivityType,
  PresenceStatusData,
  AuditLogEvent,
} from "discord.js";
import { getConfig, setConfig, getSuspectKeywords, addSuspectKeyword, removeSuspectKeyword } from "../bot/guild-config-store.js";
import { getAntilinkConfig, setAntilinkConfig } from "../bot/antilink-store.js";
import { addToGlobalBlacklist, removeFromGlobalBlacklist, addToBlacklist, removeFromBlacklist } from "../bot/blacklist-store.js";
import { sendAll as sendErrTest } from "../bot/commands/errortest.js";
import { notifyActionDM } from "../bot/dm-notify.js";
import { addActionLog, getActionLog } from "../bot/owner-action-log.js";
import { getAllNotesForGuild, getNotes, deleteNote, clearNotes } from "../bot/notes-store.js";
import { getAllWarningsForGuild, getWarnings, clearWarnings, removeWarningByCase } from "../bot/warnings-store.js";
import { getInviteBlacklist, removeInviteBlacklist } from "../bot/invite-blacklist-store.js";
import { getQuarantineList, removeQuarantine, QuarantineEntry } from "../bot/quarantine-store.js";
import { resetStaffWindow } from "../bot/staff-ratelimit.js";
import { getVoiceLog, clearVoiceLog } from "../bot/voice-monitor.js";
import { getBotRepliesForGuild } from "../bot/event-log-store.js";
import { getBotStatusEvents } from "../bot/bot-status-store.js";
import { getAllTempBansForGuild, removeTempBan, hasTempBan, getTempBan } from "../bot/tempban-store.js";
import { isMaintenanceMode, getMaintenanceState, setMaintenance } from "../bot/maintenance-store.js";
import { getCustomCommands, addCustomCommand, removeCustomCommand } from "../bot/custom-commands-store.js";
import { getGlobalWordBlacklist, addGlobalWord, removeGlobalWord } from "../bot/global-word-blacklist-store.js";

const router = Router();

router.use(authMiddleware);
router.use(ownerMiddleware);

// ── DM notification + journal des actions ─────────────────────────────────────
router.use((req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    addActionLog({ timestamp: new Date().toISOString(), method: req.method, path: req.path, body: req.body ?? {} });
    const client = getClient();
    if (client?.isReady()) {
      notifyActionDM(client, req.method, req.path, req.body).catch(() => null);
    }
  }
  next();
});

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
    // Sync in-memory store
    addToGlobalBlacklist({ userId, userTag, reason, moderatorTag, moderatorId, timestamp: new Date() });
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
    // Sync store global
    removeFromGlobalBlacklist(userId);
    // Sync store guild-level pour que blacklistinfo soit à jour sur tous les serveurs
    const client = getClient();
    if (client) {
      for (const [guildId] of client.guilds.cache) {
        removeFromBlacklist(guildId, userId);
      }
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/owner/blacklist/recover — récupère les bans [BLACKLIST] depuis l'audit log Discord ──
router.post("/owner/blacklist/recover", async (_req, res) => {
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non connecté" }); return; }

  const recovered: { userId: string; userTag: string; reason: string; guildId: string; guildName: string }[] = [];
  const errors: string[] = [];

  for (const [, guild] of client.guilds.cache) {
    try {
      let before: string | undefined;
      let keepFetching = true;

      while (keepFetching) {
        const entries = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanAdd,
          limit: 100,
          ...(before ? { before } : {}),
        });

        if (entries.entries.size === 0) break;

        for (const entry of entries.entries.values()) {
          const reason = entry.reason ?? "";
          if (!reason.includes("[BLACKLIST]") && !reason.includes("[GLOBAL BLACKLIST]")) continue;
          if (!entry.target) continue;

          const userId = entry.target.id;
          let userTag = "Inconnu";
          try {
            const user = await client.users.fetch(userId);
            userTag = user.tag;
          } catch { /* utilisateur inconnu */ }

          // Nettoie la raison — retire le préfixe [BLACKLIST] ou [GLOBAL BLACKLIST]
          const cleanReason = reason
            .replace(/^\[GLOBAL BLACKLIST\]\s*/i, "")
            .replace(/^\[BLACKLIST\]\s*/i, "")
            .replace(/ — blacklisté sur .+$/, "")
            .trim() || "Blacklist (récupéré depuis l'audit log)";

          const executorTag = entry.executor?.tag ?? "Inconnu";
          const executorId = entry.executorId ?? client.user!.id;

          recovered.push({ userId, userTag, reason: cleanReason, guildId: guild.id, guildName: guild.name });

          // Insère en DB (ignore les doublons)
          try {
            await addToGlobalBlacklistDB({ userId, userTag, reason: cleanReason, moderatorTag: executorTag, moderatorId: executorId });
            addToGlobalBlacklist({ userId, userTag, reason: cleanReason, moderatorTag: executorTag, moderatorId: executorId, timestamp: entry.createdAt });
          } catch (e: any) {
            errors.push(`${userId}: ${e.message}`);
          }
        }

        // Pagination : si moins de 100 résultats, on a tout récupéré
        if (entries.entries.size < 100) {
          keepFetching = false;
        } else {
          before = entries.entries.last()?.id;
        }
      }
    } catch (e: any) {
      errors.push(`Guild ${guild.id}: ${e.message}`);
    }
  }

  // Déduplique par userId (un même user peut apparaître sur plusieurs serveurs)
  const seen = new Set<string>();
  const unique = recovered.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });

  res.json({ recovered: unique.length, entries: unique, errors });
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
    const guildId = req.params["guildId"] as string;
    const settings = await getGuildSettings(guildId);
    const cfg = getConfig(guildId);
    res.json({ ...settings, captchaEnabled: cfg.captchaEnabled || settings.captchaEnabled });
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

// ── Test Bot (webhooks) ───────────────────────────────────────────────────────
router.get("/owner/guilds/:guildId/testbot", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const webhooks = await guild.fetchWebhooks();
    const list = [...webhooks.values()]
      .filter((w) => w.name.startsWith("[TestBot] "))
      .map((w) => ({ id: w.id, name: w.name.replace("[TestBot] ", ""), channelId: w.channelId ?? "" }));
    res.json(list);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/guilds/:guildId/testbot", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, nom } = (req.body ?? {}) as { channelId?: string; nom?: string };
  if (!channelId || !nom) { res.status(400).json({ error: "channelId et nom requis" }); return; }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) { res.status(400).json({ error: "Salon texte introuvable" }); return; }
    const fullName = `[TestBot] ${String(nom).slice(0, 70)}`;
    const webhooks = await guild.fetchWebhooks();
    if (webhooks.find((w) => w.name === fullName)) {
      res.status(409).json({ error: `Un bot de test nommé "${nom}" existe déjà.` }); return;
    }
    const wh = await (ch as TextChannel).createWebhook({ name: fullName, reason: "Bot de test — Dashboard Owner" });
    res.json({ id: wh.id, name: nom, channelId: ch.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/guilds/:guildId/testbot/send", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { nom, channelId, action, content, count } = (req.body ?? {}) as {
    nom?: string; channelId?: string; action?: string; content?: string; count?: number;
  };
  if (!nom || !channelId || !action) { res.status(400).json({ error: "nom, channelId et action requis" }); return; }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const webhooks = await guild.fetchWebhooks();
    const wh = webhooks.find((w) => w.name === `[TestBot] ${nom}` && w.channelId === channelId);
    if (!wh?.token) { res.status(404).json({ error: `Bot de test "${nom}" introuvable dans ce salon.` }); return; }
    const whClient = new WebhookClient({ id: wh.id, token: wh.token });
    if (action === "message") {
      await whClient.send({ content: String(content || "Test message") });
    } else if (action === "spam") {
      const n = Math.min(Math.max(Number(count ?? 6), 2), 10);
      for (let i = 0; i < n; i++) {
        await whClient.send({ content: `Test spam message ${i + 1} !!!` });
        await new Promise((r) => setTimeout(r, 200));
      }
    } else if (action === "insulte") {
      const cfg = getConfig(guildId);
      const mot = cfg.antiInsultWords[0] ?? "idiot";
      await whClient.send({ content: `Test détection insulte : ${mot}` });
    } else if (action === "lien") {
      await whClient.send({ content: "Test lien non autorisé : discord.gg/testlink123" });
    } else {
      res.status(400).json({ error: "Action inconnue" }); return;
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/guilds/:guildId/testbot/:nom", async (req, res) => {
  const { guildId, nom } = req.params as { guildId: string; nom: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const webhooks = await guild.fetchWebhooks();
    const wh = webhooks.find((w) => w.name === `[TestBot] ${nom}` || w.name.replace("[TestBot] ", "") === nom);
    if (!wh) { res.status(404).json({ error: "Bot de test introuvable" }); return; }
    await wh.delete("Suppression via Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Send Embed ────────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/send-embed", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, title, description, color, imageURL, footer } = req.body as {
    channelId?: string; title?: string; description?: string;
    color?: string; imageURL?: string; footer?: string;
  };
  if (!channelId || (!title?.trim() && !description?.trim())) {
    res.status(400).json({ error: "channelId + titre ou description requis" }); return;
  }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      res.status(400).json({ error: "Salon textuel introuvable" }); return;
    }
    const embed = new EmbedBuilder();
    if (title?.trim()) embed.setTitle(title.trim().slice(0, 256));
    if (description?.trim()) embed.setDescription(description.trim().slice(0, 4096));
    if (color) { try { embed.setColor(color as any); } catch { /* ignore */ } }
    if (imageURL?.trim()) { try { embed.setImage(imageURL.trim()); } catch { /* ignore */ } }
    if (footer?.trim()) embed.setFooter({ text: footer.trim().slice(0, 2048) });
    embed.setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    res.json({ ok: true, messageId: msg.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Schedule Message ──────────────────────────────────────────────────────────
const scheduledMsgs = new Map<string, ReturnType<typeof setTimeout>>();
router.post("/owner/guilds/:guildId/schedule-message", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, content, delayMinutes } = req.body as {
    channelId?: string; content?: string; delayMinutes?: number;
  };
  if (!channelId || !content?.trim() || !delayMinutes || Number(delayMinutes) < 1) {
    res.status(400).json({ error: "channelId, content et delayMinutes (≥1) requis" }); return;
  }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      res.status(400).json({ error: "Salon textuel introuvable" }); return;
    }
    const delay = Math.min(Number(delayMinutes), 1440) * 60 * 1000;
    const key = `${guildId}-${channelId}-${Date.now()}`;
    const timer = setTimeout(async () => {
      scheduledMsgs.delete(key);
      await (channel as TextChannel).send(content.trim()).catch(() => null);
    }, delay);
    scheduledMsgs.set(key, timer);
    const sendAt = new Date(Date.now() + delay).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    res.json({ ok: true, scheduledAt: sendAt });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Edit Bot Message ──────────────────────────────────────────────────────────
router.patch("/owner/guilds/:guildId/channels/:channelId/messages/:messageId", async (req, res) => {
  const { guildId, channelId, messageId } = req.params as { guildId: string; channelId: string; messageId: string };
  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content requis" }); return; }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      res.status(400).json({ error: "Salon introuvable" }); return;
    }
    const message = await channel.messages.fetch(messageId);
    if (message.author.id !== client!.user!.id) {
      res.status(403).json({ error: "Seuls les messages du bot peuvent être modifiés" }); return;
    }
    await message.edit(content.trim());
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Unban ─────────────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/members/unban", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { userId, reason } = req.body as { userId?: string; reason?: string };
  if (!userId?.trim()) { res.status(400).json({ error: "userId requis" }); return; }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    await guild.members.unban(userId.trim(), reason?.trim() || "Débanni via Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Add / Remove Role ─────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/members/:memberId/role", async (req, res) => {
  const { guildId, memberId } = req.params as { guildId: string; memberId: string };
  const { roleId, action } = req.body as { roleId?: string; action?: "add" | "remove" };
  if (!roleId || !action) { res.status(400).json({ error: "roleId et action requis" }); return; }
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const member = await guild.members.fetch(memberId);
    const role = guild.roles.cache.get(roleId);
    if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }
    const botMember = guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      res.status(403).json({ error: "Position du rôle trop haute pour le bot" }); return;
    }
    if (action === "add") {
      await member.roles.add(role, "Rôle ajouté via Dashboard Owner");
    } else {
      await member.roles.remove(role, "Rôle retiré via Dashboard Owner");
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Lock Channel ──────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/channels/:channelId/lock", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId) as TextChannel | null;
    if (!channel || !("permissionOverwrites" in channel)) { res.status(400).json({ error: "Salon introuvable" }); return; }
    await channel.permissionOverwrites.edit(guildId, { SendMessages: false });
    if (!channel.name.startsWith("🔒")) await channel.setName("🔒" + channel.name).catch(() => null);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Unlock Channel ────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/channels/:channelId/unlock", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId) as TextChannel | null;
    if (!channel || !("permissionOverwrites" in channel)) { res.status(400).json({ error: "Salon introuvable" }); return; }
    await channel.permissionOverwrites.edit(guildId, { SendMessages: null });
    if (channel.name.startsWith("🔒")) await channel.setName(channel.name.slice(2)).catch(() => null);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Purge Channel ─────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/channels/:channelId/purge", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const { limit, userId } = req.body as { limit?: number; userId?: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) { res.status(400).json({ error: "Salon textuel introuvable" }); return; }
    const fetchLimit = Math.min(Math.max(Number(limit ?? 50), 1), 100);
    const fetched = await channel.messages.fetch({ limit: fetchLimit });
    const toDelete = userId?.trim() ? fetched.filter((m) => m.author.id === userId.trim()) : fetched;
    if (toDelete.size === 0) { res.json({ ok: true, deleted: 0 }); return; }
    const result = await channel.bulkDelete(toDelete, true);
    res.json({ ok: true, deleted: result.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Slowmode ──────────────────────────────────────────────────────────────────
router.patch("/owner/guilds/:guildId/channels/:channelId/slowmode", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const { seconds } = req.body as { seconds?: number };
  const s = Math.min(Math.max(Number(seconds ?? 0), 0), 21600);
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId) as TextChannel | null;
    if (!channel || !("setRateLimitPerUser" in channel)) { res.status(400).json({ error: "Salon introuvable ou incompatible" }); return; }
    await (channel as TextChannel).setRateLimitPerUser(s, "Slowmode via Dashboard Owner");
    res.json({ ok: true, seconds: s });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Automod Config ────────────────────────────────────────────────────────────
router.get("/owner/guilds/:guildId/automod", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  try {
    const cfg = getConfig(guildId);
    const al = getAntilinkConfig(guildId);
    res.json({
      antiInsultEnabled: cfg.antiInsultEnabled,
      antiInsultWords: cfg.antiInsultWords,
      antiWebhookEnabled: cfg.antiWebhookEnabled,
      securityLevel: cfg.securityLevel,
      antilinkEnabled: al.enabled,
      antilinkAction: al.action,
      antilinkTimeoutMinutes: al.timeoutMinutes,
      antilinkAllowedDomains: al.allowedDomains,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/owner/guilds/:guildId/automod", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const {
    antiInsultEnabled, antiInsultWords, antiWebhookEnabled, securityLevel,
    antilinkEnabled, antilinkAction, antilinkTimeoutMinutes, antilinkAllowedDomains,
  } = (req.body ?? {}) as {
    antiInsultEnabled?: boolean; antiInsultWords?: string[]; antiWebhookEnabled?: boolean;
    securityLevel?: 1 | 2 | 3; antilinkEnabled?: boolean;
    antilinkAction?: "delete" | "warn" | "timeout"; antilinkTimeoutMinutes?: number;
    antilinkAllowedDomains?: string[];
  };
  try {
    const gPatch: Record<string, unknown> = {};
    if (antiInsultEnabled !== undefined) gPatch["antiInsultEnabled"] = antiInsultEnabled;
    if (antiInsultWords !== undefined) gPatch["antiInsultWords"] = antiInsultWords;
    if (antiWebhookEnabled !== undefined) gPatch["antiWebhookEnabled"] = antiWebhookEnabled;
    if (securityLevel !== undefined) gPatch["securityLevel"] = securityLevel;
    if (Object.keys(gPatch).length > 0) setConfig(guildId, gPatch as any);

    const alPatch: Record<string, unknown> = {};
    if (antilinkEnabled !== undefined) alPatch["enabled"] = antilinkEnabled;
    if (antilinkAction !== undefined) alPatch["action"] = antilinkAction;
    if (antilinkTimeoutMinutes !== undefined) alPatch["timeoutMinutes"] = antilinkTimeoutMinutes;
    if (antilinkAllowedDomains !== undefined) alPatch["allowedDomains"] = antilinkAllowedDomains;
    if (Object.keys(alPatch).length > 0) setAntilinkConfig(guildId, alPatch as any);

    const cfg = getConfig(guildId);
    const al = getAntilinkConfig(guildId);
    res.json({
      antiInsultEnabled: cfg.antiInsultEnabled,
      antiInsultWords: cfg.antiInsultWords,
      antiWebhookEnabled: cfg.antiWebhookEnabled,
      securityLevel: cfg.securityLevel,
      antilinkEnabled: al.enabled,
      antilinkAction: al.action,
      antilinkTimeoutMinutes: al.timeoutMinutes,
      antilinkAllowedDomains: al.allowedDomains,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Active Tickets ────────────────────────────────────────────────────────────
import { getTicketsByGuild, getTicketByChannel, closeTicket as closeTicketInStore } from "../bot/ticket-store.js";
import { buildTranscriptContent, saveTranscriptToDB } from "../bot/transcript-db.js";
import { sendLog, logEmbed } from "../bot/log.js";

router.get("/owner/guilds/:guildId/tickets", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  try {
    const tickets = getTicketsByGuild(guildId);
    res.json(tickets.map((t) => ({
      channelId: t.channelId,
      ticketNumber: t.ticketNumber,
      userId: t.userId,
      username: t.username,
      claimedBy: t.claimedBy,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/guilds/:guildId/tickets/:channelId/close", async (req, res) => {
  const { guildId, channelId } = req.params as { guildId: string; channelId: string };
  const { reason } = (req.body ?? {}) as { reason?: string };
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) {
      res.status(404).json({ error: "Salon ticket introuvable" }); return;
    }
    const payload = (req as any).jwtPayload as { userTag?: string; userId?: string } | undefined;
    const closedBy = payload?.userTag ?? "Dashboard Owner";
    const closedById = payload?.userId ?? "0";
    const closingReason = reason?.trim() || "Fermé via Dashboard Owner";
    const ticket = getTicketByChannel(channelId);
    if (ticket) {
      const { content, count } = await buildTranscriptContent(channel);
      await saveTranscriptToDB({
        ticket, guildName: guild.name, channelName: channel.name,
        content, messageCount: count, closedBy, closedById, reason: closingReason,
      }).catch(() => null);
    }
    const embed = new EmbedBuilder()
      .setColor(0xef4444).setTitle("🔒 Ticket fermé (Dashboard)")
      .addFields(
        { name: "Fermé par", value: closedBy, inline: true },
        { name: "Raison", value: closingReason, inline: true },
        ...(ticket ? [{ name: "Ticket", value: `#${ticket.ticketNumber}`, inline: true }] : []),
      )
      .setFooter({ text: "Ce salon sera supprimé dans 5 secondes." })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
    await sendLog(client, logEmbed(0xef4444, "🔒 Ticket fermé (Dashboard)", [
      { name: "Salon", value: channel.name, inline: true },
      { name: "Raison", value: closingReason, inline: true },
    ], { tag: closedBy, id: closedById }), { guildId });
    setTimeout(async () => {
      closeTicketInStore(channelId);
      await channel.delete("Ticket fermé via dashboard").catch(() => null);
    }, 5000);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Bot Status & Control ──────────────────────────────────────────────────────
router.get("/owner/bot/status", (req, res) => {
  const client = getClient();
  if (!client || !client.isReady()) {
    res.json({ online: false, wsStatus: -1, ping: -1, uptime: null, guildCount: 0, userCount: 0, memory: process.memoryUsage().heapUsed, username: null, avatarURL: null, presence: null });
    return;
  }
  const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
  res.json({
    online: true,
    wsStatus: client.ws.status,
    ping: client.ws.ping,
    uptime: client.uptime,
    guildCount: client.guilds.cache.size,
    userCount: totalUsers,
    memory: process.memoryUsage().heapUsed,
    username: client.user.username,
    tag: client.user.tag,
    avatarURL: client.user.displayAvatarURL({ size: 64 }),
    presence: {
      status: client.user.presence?.status ?? "online",
      activities: client.user.presence?.activities?.map((a) => ({ name: a.name, type: a.type })) ?? [],
    },
  });
});

router.post("/owner/bot/restart", async (req, res) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Client introuvable" }); return; }
  const token = process.env["DISCORD_TOKEN"];
  if (!token) { res.status(503).json({ error: "DISCORD_TOKEN manquant" }); return; }
  try {
    req.log.info("Bot restart demandé via dashboard");
    client.destroy();
    await client.login(token);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/bot/disconnect", (req, res) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Client introuvable" }); return; }
  req.log.info("Bot disconnect demandé via dashboard");
  client.destroy();
  res.json({ ok: true });
});

router.post("/owner/bot/reconnect", async (req, res) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Client introuvable" }); return; }
  const token = process.env["DISCORD_TOKEN"];
  if (!token) { res.status(503).json({ error: "DISCORD_TOKEN manquant" }); return; }
  try {
    req.log.info("Bot reconnect demandé via dashboard");
    await client.login(token);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/owner/bot/presence", async (req, res) => {
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const { status, activityType, activityText } = req.body as { status?: string; activityType?: number; activityText?: string };
  try {
    const presenceData: Parameters<typeof client.user.setPresence>[0] = {};
    if (status) presenceData.status = status as PresenceStatusData;
    if (activityText) {
      const type = (activityType ?? ActivityType.Playing) as ActivityType;
      presenceData.activities = [{ name: activityText, type }];
    } else if (activityText === "") {
      presenceData.activities = [];
    }
    client.user.setPresence(presenceData);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/bot/broadcast", async (req, res) => {
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message vide" }); return; }
  const results: { guildId: string; guildName: string; ok: boolean; error?: string }[] = [];
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = getConfig(guild.id);
      const logChannelId = cfg?.logChannelId;
      if (!logChannelId) { results.push({ guildId: guild.id, guildName: guild.name, ok: false, error: "Pas de salon log configuré" }); continue; }
      const channel = guild.channels.cache.get(logChannelId);
      if (!channel?.isTextBased()) { results.push({ guildId: guild.id, guildName: guild.name, ok: false, error: "Salon introuvable" }); continue; }
      await channel.send({ content: message.trim() });
      results.push({ guildId: guild.id, guildName: guild.name, ok: true });
    } catch (e: any) {
      results.push({ guildId: guild.id, guildName: guild.name, ok: false, error: e.message });
    }
  }
  res.json({ results });
});

// ── GET /api/owner/guilds/:guildId/member-profile/:userId ─────────────────────
router.get("/owner/guilds/:guildId/member-profile/:userId", async (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const client = getClient();
  const guild = client?.isReady() ? await client.guilds.fetch(guildId).catch(() => null) : null;
  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
  const warns = getWarnings(guildId, userId);
  const notes = getNotes(guildId, userId);
  const tempban = hasTempBan(guildId, userId) ? getTempBan(guildId, userId) : null;
  const qEntry = getQuarantineList(guildId).find(e => e.userId === userId) ?? null;
  const voiceEvents = getVoiceLog(guildId).filter(e => e.userId === userId).slice(0, 20);
  res.json({
    userId,
    userTag: member?.user.tag ?? null,
    displayName: member?.displayName ?? null,
    avatarURL: member?.user.displayAvatarURL() ?? null,
    joinedAt: member?.joinedAt?.toISOString() ?? null,
    roles: member?.roles.cache.filter(r => r.id !== guildId).map(r => ({ id: r.id, name: r.name, color: r.hexColor })) ?? [],
    timed_out_until: member?.communicationDisabledUntil?.toISOString() ?? null,
    warns,
    notes,
    tempban,
    quarantine: qEntry,
    voiceEvents,
  });
});

// ── DELETE /api/owner/guilds/:guildId/warns/:userId ───────────────────────────
router.delete("/owner/guilds/:guildId/warns/:userId", (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const count = clearWarnings(guildId, userId);
  res.json({ ok: true, count });
});

// ── DELETE /api/owner/guilds/:guildId/warns/:userId/:caseId ──────────────────
router.delete("/owner/guilds/:guildId/warns/:userId/:caseId", (req, res) => {
  const { guildId, userId, caseId } = req.params as Record<string, string>;
  const ok = removeWarningByCase(guildId, userId, Number(caseId));
  res.json({ ok });
});

// ── GET /api/owner/guilds/:guildId/tempbans ───────────────────────────────────
router.get("/owner/guilds/:guildId/tempbans", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getAllTempBansForGuild(guildId));
});

// ── DELETE /api/owner/guilds/:guildId/tempbans/:userId ────────────────────────
router.delete("/owner/guilds/:guildId/tempbans/:userId", async (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const client = getClient();
  removeTempBan(guildId, userId);
  if (client?.isReady()) {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (guild) await guild.members.unban(userId, "Tempban annulé depuis le panel owner").catch(() => null);
    } catch { /* ignore */ }
  }
  res.json({ ok: true });
});

// ── GET /api/owner/guilds/:guildId/timeouts ───────────────────────────────────
router.get("/owner/guilds/:guildId/timeouts", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    const members = await guild.members.fetch().catch(() => null);
    if (!members) { res.json([]); return; }
    const timed = members
      .filter(m => m.isCommunicationDisabled())
      .map(m => ({
        userId: m.id,
        userTag: m.user.tag,
        displayName: m.displayName,
        avatarURL: m.user.displayAvatarURL(),
        until: m.communicationDisabledUntil?.toISOString() ?? null,
      }));
    res.json([...timed.values()]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/owner/guilds/:guildId/timeouts/:userId ────────────────────────
router.delete("/owner/guilds/:guildId/timeouts/:userId", async (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!member) { res.status(404).json({ error: "Membre introuvable" }); return; }
    await member.disableCommunicationUntil(null, "Timeout levé depuis le panel owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/maintenance ────────────────────────────────
router.get("/owner/guilds/:guildId/maintenance", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getMaintenanceState(guildId));
});

// ── PATCH /api/owner/guilds/:guildId/maintenance ──────────────────────────────
router.patch("/owner/guilds/:guildId/maintenance", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { active, message } = req.body as { active?: boolean; message?: string };
  if (typeof active !== "boolean") { res.status(400).json({ error: "active (boolean) requis" }); return; }
  setMaintenance(guildId, active, message);
  res.json(getMaintenanceState(guildId));
});

// ── POST /api/owner/guilds/:guildId/mass-action ───────────────────────────────
router.post("/owner/guilds/:guildId/mass-action", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { action, roleId, reason, timeoutMinutes } = req.body as { action: "kick" | "ban" | "timeout"; roleId: string; reason?: string; timeoutMinutes?: number };
  if (!action || !roleId) { res.status(400).json({ error: "action et roleId requis" }); return; }
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    const members = await guild.members.fetch().catch(() => null);
    if (!members) { res.json({ ok: true, count: 0 }); return; }
    const targets = [...members.values()].filter(m => m.roles.cache.has(roleId) && !m.user.bot);
    const r = reason?.trim() || `Masse-action depuis le panel owner (${action})`;
    let count = 0;
    for (const m of targets) {
      try {
        if (action === "kick") await m.kick(r);
        else if (action === "ban") await guild.members.ban(m.id, { reason: r });
        else if (action === "timeout") await m.disableCommunicationUntil(new Date(Date.now() + (timeoutMinutes ?? 60) * 60000), r);
        count++;
      } catch { /* membre protégé */ }
    }
    res.json({ ok: true, count });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/invites ────────────────────────────────────
router.get("/owner/guilds/:guildId/invites", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) { res.json([]); return; }
    res.json([...invites.values()].map(inv => ({
      code: inv.code,
      url: inv.url,
      uses: inv.uses,
      maxUses: inv.maxUses,
      creatorTag: inv.inviter?.tag ?? null,
      creatorId: inv.inviter?.id ?? null,
      channelName: inv.channel?.name ?? null,
      temporary: inv.temporary,
      expiresAt: inv.expiresAt?.toISOString() ?? null,
      createdAt: inv.createdAt?.toISOString() ?? null,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/owner/guilds/:guildId/invites/:code ───────────────────────────
router.delete("/owner/guilds/:guildId/invites/:code", async (req, res) => {
  const { guildId, code } = req.params as Record<string, string>;
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    await guild.invites.delete(code, "Révoquée depuis le panel owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/owner/guilds/:guildId/invites/create ───────────────────────────
router.post("/owner/guilds/:guildId/invites/create", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, maxAge, maxUses, temporary } = req.body as { channelId?: string; maxAge?: number; maxUses?: number; temporary?: boolean };
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    const targetChannelId = channelId ?? getConfig(guildId).generalLogChannelId ?? guild.systemChannelId ?? [...guild.channels.cache.values()].find(c => c.type === 0)?.id;
    if (!targetChannelId) { res.status(400).json({ error: "Aucun salon disponible" }); return; }
    const ch = guild.channels.cache.get(targetChannelId);
    if (!ch?.isTextBased()) { res.status(400).json({ error: "Salon invalide" }); return; }
    const inv = await (ch as TextChannel).createInvite({ maxAge: maxAge ?? 0, maxUses: maxUses ?? 0, temporary: temporary ?? false, reason: "Créée depuis le panel owner" });
    res.json({ code: inv.code, url: inv.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/audit-log ──────────────────────────────────
router.get("/owner/guilds/:guildId/audit-log", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
    const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
    const auditLogs = await guild.fetchAuditLogs({ limit }).catch(() => null);
    if (!auditLogs) { res.json([]); return; }
    res.json([...auditLogs.entries.values()].map(e => ({
      id: e.id,
      action: e.action,
      actionType: AuditLogEvent[e.action] ?? String(e.action),
      executorTag: e.executor?.tag ?? null,
      executorId: e.executorId,
      targetId: e.targetId,
      reason: e.reason ?? null,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/log-channels ───────────────────────────────
router.get("/owner/guilds/:guildId/log-channels", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const cfg = getConfig(guildId);
  res.json({
    logChannelId: cfg.logChannelId ?? null,
    banLogChannelId: cfg.banLogChannelId ?? null,
    generalLogChannelId: cfg.generalLogChannelId ?? null,
    inviteLogChannelId: cfg.inviteLogChannelId ?? null,
    messageLogChannelId: cfg.messageLogChannelId ?? null,
  });
});

// ── PATCH /api/owner/guilds/:guildId/log-channels ─────────────────────────────
router.patch("/owner/guilds/:guildId/log-channels", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { logChannelId, banLogChannelId, generalLogChannelId, inviteLogChannelId, messageLogChannelId } = req.body as Record<string, string | null>;
  const cfg = getConfig(guildId);
  setConfig(guildId, {
    ...cfg,
    logChannelId: logChannelId !== undefined ? logChannelId : cfg.logChannelId,
    banLogChannelId: banLogChannelId !== undefined ? banLogChannelId : cfg.banLogChannelId,
    generalLogChannelId: generalLogChannelId !== undefined ? generalLogChannelId : cfg.generalLogChannelId,
    inviteLogChannelId: inviteLogChannelId !== undefined ? inviteLogChannelId : cfg.inviteLogChannelId,
    messageLogChannelId: messageLogChannelId !== undefined ? messageLogChannelId : cfg.messageLogChannelId,
  });
  res.json(getConfig(guildId));
});

// ── GET /api/owner/guilds/:guildId/config/export ─────────────────────────────
router.get("/owner/guilds/:guildId/config/export", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const cfg = getConfig(guildId);
  const antilink = getAntilinkConfig(guildId);
  const json = JSON.stringify({ guildId, config: cfg, antilink, exportedAt: new Date().toISOString() }, null, 2);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="config-${guildId}.json"`);
  res.send(json);
});

// ── POST /api/owner/guilds/:guildId/config/import ────────────────────────────
router.post("/owner/guilds/:guildId/config/import", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { config } = req.body as { config?: Record<string, unknown> };
  if (!config || typeof config !== "object") { res.status(400).json({ error: "config requis" }); return; }
  try {
    setConfig(guildId, config as any);
    res.json({ ok: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/custom-commands ───────────────────────────
router.get("/owner/guilds/:guildId/custom-commands", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getCustomCommands(guildId));
});

// ── POST /api/owner/guilds/:guildId/custom-commands ──────────────────────────
router.post("/owner/guilds/:guildId/custom-commands", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const payload = (req as any).jwtPayload as { userTag?: string } | undefined;
  const { name, response } = req.body as { name?: string; response?: string };
  if (!name?.trim() || !response?.trim()) { res.status(400).json({ error: "name et response requis" }); return; }
  const cmd = { name: name.trim().toLowerCase(), response: response.trim(), createdBy: payload?.userTag ?? "owner", createdAt: new Date().toISOString() };
  const created = addCustomCommand(guildId, cmd);
  res.json({ ok: true, created, cmd });
});

// ── DELETE /api/owner/guilds/:guildId/custom-commands/:name ──────────────────
router.delete("/owner/guilds/:guildId/custom-commands/:name", (req, res) => {
  const { guildId, name } = req.params as Record<string, string>;
  const ok = removeCustomCommand(guildId, decodeURIComponent(name));
  res.json({ ok });
});

// ── GET /api/owner/global/word-blacklist ─────────────────────────────────────
router.get("/owner/global/word-blacklist", (_req, res) => {
  res.json(getGlobalWordBlacklist());
});

// ── POST /api/owner/global/word-blacklist ────────────────────────────────────
router.post("/owner/global/word-blacklist", (req, res) => {
  const { word } = req.body as { word?: string };
  if (!word?.trim()) { res.status(400).json({ error: "word requis" }); return; }
  const ok = addGlobalWord(word.trim());
  res.json({ ok, words: getGlobalWordBlacklist() });
});

// ── DELETE /api/owner/global/word-blacklist/:word ────────────────────────────
router.delete("/owner/global/word-blacklist/:word", (req, res) => {
  const { word } = req.params as { word: string };
  const ok = removeGlobalWord(decodeURIComponent(word));
  res.json({ ok, words: getGlobalWordBlacklist() });
});

// ── GET /api/owner/global/member/:userId ─────────────────────────────────────
router.get("/owner/global/member/:userId", async (req, res) => {
  const { userId } = req.params as { userId: string };
  const client = getClient();
  if (!client?.isReady()) { res.status(503).json({ error: "Bot non prêt" }); return; }
  const results = await Promise.all([...client.guilds.cache.values()].map(async (guild) => {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return null;
      return {
        guildId: guild.id,
        guildName: guild.name,
        userTag: member.user.tag,
        displayName: member.displayName,
        avatarURL: member.user.displayAvatarURL(),
        joinedAt: member.joinedAt?.toISOString() ?? null,
        roles: member.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name })),
        timedOut: member.isCommunicationDisabled(),
        warnCount: getWarnings(guild.id, userId).length,
      };
    } catch { return null; }
  }));
  res.json(results.filter(Boolean));
});

// ── GET /api/owner/guilds — liste tous les serveurs ──────────────────────────
router.get("/owner/guilds", (_req, res) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non prêt" }); return; }
  const guilds = [...client.guilds.cache.values()].map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.memberCount,
    iconURL: g.iconURL() ?? null,
  }));
  res.json(guilds);
});

// ── POST /api/owner/guilds/:guildId/clone-config ──────────────────────────────
router.post("/owner/guilds/:guildId/clone-config", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { targetGuildId } = req.body as { targetGuildId?: string };
  if (!targetGuildId) { res.status(400).json({ error: "targetGuildId requis" }); return; }
  if (targetGuildId === guildId) { res.status(400).json({ error: "Source et cible identiques" }); return; }
  try {
    const cfg = getConfig(guildId);
    setConfig(targetGuildId, cfg);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/sanctions/export ───────────────────────────
router.get("/owner/guilds/:guildId/sanctions/export", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  try {
    const rows = getAllWarningsForGuild(guildId);
    const lines: string[] = ["userId,caseId,reason,moderator,timestamp"];
    for (const { userId, warnings } of rows) {
      for (const w of warnings) {
        const safe = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
        lines.push([safe(userId), w.caseId, safe(w.reason), safe(w.moderator), w.timestamp.toISOString()].join(","));
      }
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sanctions-${guildId}.csv"`);
    res.send(lines.join("\n"));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/guilds/:guildId/notes ─────────────────────────────────────
router.get("/owner/guilds/:guildId/notes", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getAllNotesForGuild(guildId));
});

// ── DELETE /api/owner/guilds/:guildId/notes/:userId/:noteId ──────────────────
router.delete("/owner/guilds/:guildId/notes/:userId/:noteId", (req, res) => {
  const { guildId, userId, noteId } = req.params as Record<string, string>;
  const deleted = deleteNote(guildId, userId, Number(noteId));
  res.json({ ok: deleted });
});

// ── DELETE /api/owner/guilds/:guildId/notes/:userId ──────────────────────────
router.delete("/owner/guilds/:guildId/notes/:userId", (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const count = clearNotes(guildId, userId);
  res.json({ ok: true, count });
});

// ── GET /api/owner/action-log ────────────────────────────────────────────────
router.get("/owner/action-log", (_req, res) => {
  res.json(getActionLog());
});

// ── GET /api/owner/guilds/:guildId/invite-blacklist ───────────────────────────
router.get("/owner/guilds/:guildId/invite-blacklist", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getInviteBlacklist(guildId));
});

// ── DELETE /api/owner/guilds/:guildId/invite-blacklist/:userId ────────────────
router.delete("/owner/guilds/:guildId/invite-blacklist/:userId", (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const ok = removeInviteBlacklist(guildId, userId);
  res.json({ ok });
});

// ── GET /api/owner/guilds/:guildId/quarantine ─────────────────────────────────
router.get("/owner/guilds/:guildId/quarantine", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getQuarantineList(guildId));
});

// ── DELETE /api/owner/guilds/:guildId/quarantine/:userId (lever la quarantaine)
router.delete("/owner/guilds/:guildId/quarantine/:userId", async (req, res) => {
  const { guildId, userId } = req.params as Record<string, string>;
  const client = getClient();
  const removed = removeQuarantine(guildId, userId);
  resetStaffWindow(guildId, userId);
  if (client?.isReady()) {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      if (member?.isCommunicationDisabled()) {
        await member.disableCommunicationUntil(null, "Quarantaine levée depuis le panel owner");
      }
    } catch { /* ignore */ }
  }
  res.json({ ok: removed });
});

// ── GET /api/owner/guilds/:guildId/anti-protection ───────────────────────────
router.get("/owner/guilds/:guildId/anti-protection", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const cfg = getConfig(guildId);
  res.json({
    antiRaiderEnabled: cfg.antiRaiderEnabled,
    antiRaiderThreshold: cfg.antiRaiderThreshold,
    antiRaiderWindow: cfg.antiRaiderWindow,
    antiRaiderAction: cfg.antiRaiderAction,
    antiMoveEnabled: cfg.antiMoveEnabled,
    antiMuteEnabled: cfg.antiMuteEnabled,
    antiDisconnectEnabled: cfg.antiDisconnectEnabled,
    antiBotEnabled: cfg.antiBotEnabled,
    antiEveryoneEnabled: cfg.antiEveryoneEnabled,
    antiEveryoneTimeoutSecs: cfg.antiEveryoneTimeoutSecs,
  });
});

// ── PATCH /api/owner/guilds/:guildId/anti-protection ─────────────────────────
router.patch("/owner/guilds/:guildId/anti-protection", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const allowed = [
    "antiRaiderEnabled", "antiRaiderThreshold", "antiRaiderWindow", "antiRaiderAction",
    "antiMoveEnabled", "antiMuteEnabled", "antiDisconnectEnabled", "antiBotEnabled",
    "antiEveryoneEnabled", "antiEveryoneTimeoutSecs",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body && key in (req.body as Record<string, unknown>)) {
      patch[key] = (req.body as Record<string, unknown>)[key];
    }
  }
  setConfig(guildId, patch as Parameters<typeof setConfig>[1]);
  const cfg = getConfig(guildId);
  res.json({
    antiRaiderEnabled: cfg.antiRaiderEnabled,
    antiRaiderThreshold: cfg.antiRaiderThreshold,
    antiRaiderWindow: cfg.antiRaiderWindow,
    antiRaiderAction: cfg.antiRaiderAction,
    antiMoveEnabled: cfg.antiMoveEnabled,
    antiMuteEnabled: cfg.antiMuteEnabled,
    antiDisconnectEnabled: cfg.antiDisconnectEnabled,
    antiBotEnabled: cfg.antiBotEnabled,
    antiEveryoneEnabled: cfg.antiEveryoneEnabled,
    antiEveryoneTimeoutSecs: cfg.antiEveryoneTimeoutSecs,
  });
});

// ── Suspect keywords ──────────────────────────────────────────────────────────
router.get("/owner/guilds/:guildId/suspect-keywords", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json({ keywords: getSuspectKeywords(guildId) });
});

router.post("/owner/guilds/:guildId/suspect-keywords", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { keyword } = (req.body ?? {}) as { keyword?: string };
  if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
    res.status(400).json({ error: "keyword requis" }); return;
  }
  addSuspectKeyword(guildId, keyword.trim().toLowerCase());
  res.json({ keywords: getSuspectKeywords(guildId) });
});

router.delete("/owner/guilds/:guildId/suspect-keywords/:keyword", (req, res) => {
  const { guildId, keyword } = req.params as { guildId: string; keyword: string };
  removeSuspectKeyword(guildId, keyword);
  res.json({ keywords: getSuspectKeywords(guildId) });
});

// ── POST /api/owner/guilds/:guildId/roles/:roleId/strip-permissions ───────────
router.post("/owner/guilds/:guildId/roles/:roleId/strip-permissions", async (req, res) => {
  const { guildId, roleId } = req.params as { guildId: string; roleId: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
  if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    res.status(403).json({ error: "Permission ManageRoles manquante" }); return;
  }
  if (role.managed || role.id === guild.id) {
    res.status(400).json({ error: "Ce rôle ne peut pas être modifié (rôle géré ou @everyone)" }); return;
  }
  try {
    await role.setPermissions(0n, "Strip permissions — Dashboard Owner");
    res.json({ ok: true, roleName: role.name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/owner/bot-status-events ─────────────────────────────────────────
router.get("/owner/bot-status-events", async (req, res) => {
  const limit = Math.min(parseInt((req.query as { limit?: string }).limit ?? "200", 10) || 200, 500);
  res.json(await getBotStatusEvents(limit));
});

// ── GET /api/owner/guilds/:guildId/bot-reply-logs ────────────────────────────
router.get("/owner/guilds/:guildId/bot-reply-logs", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const limit = Math.min(parseInt((req.query as { limit?: string }).limit ?? "100", 10) || 100, 200);
  try {
    const logs = await getBotRepliesForGuild(guildId, limit);
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/owner/guilds/:guildId/voice-log ──────────────────────────────────
router.get("/owner/guilds/:guildId/voice-log", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  res.json(getVoiceLog(guildId));
});

// ── DELETE /api/owner/guilds/:guildId/voice-log ───────────────────────────────
router.delete("/owner/guilds/:guildId/voice-log", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  clearVoiceLog(guildId);
  res.json({ ok: true });
});

// ── Error Test (alertes DM) ───────────────────────────────────────────────────
router.post("/owner/errortest", async (req, res) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const payload = (req as any).jwtPayload as { userTag?: string } | undefined;
  try {
    void sendErrTest(client, payload?.userTag ?? "Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── User Commands ─────────────────────────────────────────────────────────────
import { getUserCommands } from "../bot/user-commands-db.js";

router.get("/owner/user-commands", async (req, res) => {
  try {
    const type = req.query["type"] as string | undefined;
    const guildId = req.query["guildId"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"] ?? 200), 500);
    const rows = await getUserCommands({ type, guildId, limit });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Suspect Accounts ──────────────────────────────────────────────────────────
import { getSuspectAccounts, deleteSuspectAccount, markSuspectVerified, updateSuspectTags } from "../bot/suspect-accounts-db.js";

router.get("/owner/suspect-accounts", async (req, res) => {
  try {
    const guildId = req.query["guildId"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"] ?? 500), 1000);
    const rows = await getSuspectAccounts({ guildId, limit });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/owner/suspect-accounts/:id", async (req, res) => {
  try {
    await deleteSuspectAccount(Number(req.params["id"]));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/owner/suspect-accounts/:id/verify", async (req, res) => {
  try {
    const verified = (req.body as { verified?: boolean }).verified ?? true;
    await markSuspectVerified(Number(req.params["id"]), verified);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/owner/suspect-accounts/:id/tags", async (req, res) => {
  try {
    const tags = (req.body as { tags?: string[] }).tags ?? [];
    await updateSuspectTags(Number(req.params["id"]), tags.map(t => t.trim()).filter(Boolean));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/suspect-accounts/bulk-action", async (req, res) => {
  const { guildId, userIds, action, durationMs } = req.body as {
    guildId: string; userIds: string[]; action: "timeout" | "kick" | "ban"; durationMs?: number;
  };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  const reason = "[Dashboard Owner] Action en masse — comptes suspects";
  const results: { userId: string; ok: boolean; error?: string }[] = [];
  for (const userId of userIds) {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) { results.push({ userId, ok: false, error: "Membre introuvable" }); continue; }
      if (action === "timeout") await member.timeout(Math.min(durationMs ?? 86_400_000, 28 * 86_400_000), reason);
      else if (action === "kick") await member.kick(reason);
      else await guild.members.ban(userId, { reason });
      results.push({ userId, ok: true });
    } catch (e: any) { results.push({ userId, ok: false, error: e.message }); }
  }
  res.json({ results });
});

// ── Timeout member ────────────────────────────────────────────────────────────
router.post("/owner/guilds/:guildId/members/:memberId/timeout", async (req, res) => {
  const { guildId, memberId } = req.params as { guildId: string; memberId: string };
  const { durationMs, reason } = req.body as { durationMs?: number; reason?: string };
  const client = getClient();
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const member = await guild.members.fetch(memberId);
    const ms = Math.min(durationMs ?? 3_600_000, 28 * 24 * 3_600_000);
    await member.timeout(ms, reason?.trim() || "Timeout via Dashboard Owner");
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Voice Presence ────────────────────────────────────────────────────────────
import { joinVoicePresence, leaveVoicePresence, updateVoicePresence, getVoicePresenceState } from "../bot/voice-presence.js";

router.get("/owner/guilds/:guildId/voice-presence", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const state = getVoicePresenceState(guildId);
  if (!state) { res.json({ connected: false }); return; }
  res.json(state);
});

router.post("/owner/guilds/:guildId/voice-presence/join", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { channelId, selfMute = false, selfDeaf = true } = (req.body ?? {}) as { channelId?: string; selfMute?: boolean; selfDeaf?: boolean };
  if (!channelId) { res.status(400).json({ error: "channelId requis" }); return; }
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    await joinVoicePresence(guild, channelId, selfMute, selfDeaf);
    res.json(getVoicePresenceState(guildId) ?? { connected: true, channelId, selfMute, selfDeaf });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/owner/guilds/:guildId/voice-presence/leave", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  leaveVoicePresence(guildId);
  res.json({ connected: false });
});

router.patch("/owner/guilds/:guildId/voice-presence", async (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const { selfMute, selfDeaf } = (req.body ?? {}) as { selfMute?: boolean; selfDeaf?: boolean };
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  try {
    const updated = await updateVoicePresence(guild, { selfMute, selfDeaf });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/owner/guilds/:guildId/voice-channels", (req, res) => {
  const { guildId } = req.params as { guildId: string };
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot non connecté" }); return; }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) { res.status(404).json({ error: "Serveur introuvable" }); return; }
  const channels = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildVoice)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(channels);
});

export default router;
