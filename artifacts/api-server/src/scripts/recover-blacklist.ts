/**
 * Script de récupération one-shot : lit les audit logs Discord pour retrouver
 * tous les bans [BLACKLIST] / [GLOBAL BLACKLIST] et les insère en DB.
 *
 * Usage : pnpm --filter @workspace/api-server run recover-blacklist
 */
import { Client, GatewayIntentBits, AuditLogEvent } from "discord.js";
import { db, globalBlacklistTable } from "@workspace/db";

const token = process.env["DISCORD_TOKEN"];
if (!token) {
  console.error("DISCORD_TOKEN manquant");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async (readyClient) => {
  console.log(`Connecté en tant que ${readyClient.user.tag}`);
  console.log(`Guilds : ${readyClient.guilds.cache.size}`);

  const results: { userId: string; userTag: string; reason: string; moderatorTag: string; moderatorId: string }[] = [];
  const seen = new Set<string>();
  const skipped: string[] = [];

  for (const [, guild] of readyClient.guilds.cache) {
    console.log(`\nScanning ${guild.name} (${guild.id})…`);
    let before: string | undefined;
    let page = 0;

    while (true) {
      const entries = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 100,
        ...(before ? { before } : {}),
      }).catch((e) => { console.error(`  fetchAuditLogs page ${page}: ${e.message}`); return null; });

      if (!entries || entries.entries.size === 0) break;
      page++;

      for (const entry of entries.entries.values()) {
        const reason = entry.reason ?? "";
        if (!reason.includes("[BLACKLIST]") && !reason.includes("[GLOBAL BLACKLIST]")) continue;
        if (!entry.target) continue;

        const userId = entry.target.id;
        if (seen.has(userId)) continue;
        seen.add(userId);

        let userTag = "Inconnu";
        try {
          const user = await readyClient.users.fetch(userId);
          userTag = user.tag;
        } catch { /* utilisateur introuvable */ }

        const cleanReason = reason
          .replace(/^\[GLOBAL BLACKLIST\]\s*/i, "")
          .replace(/^\[BLACKLIST\]\s*/i, "")
          .replace(/ — blacklisté sur .+$/i, "")
          .trim() || "Blacklist (récupéré depuis l'audit log)";

        const executorTag = entry.executor?.tag ?? "Inconnu";
        const executorId = entry.executorId ?? readyClient.user.id;

        console.log(`  TROUVÉ : ${userTag} (${userId}) — "${cleanReason}" par ${executorTag}`);
        results.push({ userId, userTag, reason: cleanReason, moderatorTag: executorTag, moderatorId: executorId });
      }

      if (entries.entries.size < 100) break;
      before = entries.entries.last()?.id;
    }
  }

  console.log(`\n${results.length} entrée(s) blacklist trouvée(s). Insertion en DB…`);

  let inserted = 0;
  let updated = 0;

  for (const entry of results) {
    try {
      const result = await db.insert(globalBlacklistTable)
        .values(entry)
        .onConflictDoNothing()
        .returning({ userId: globalBlacklistTable.userId });

      if (result.length > 0) {
        inserted++;
        console.log(`  ✓ Inséré : ${entry.userTag} (${entry.userId})`);
      } else {
        updated++;
        console.log(`  (déjà en DB) ${entry.userTag} (${entry.userId})`);
      }
    } catch (e: any) {
      console.error(`  ✗ Erreur pour ${entry.userId}: ${e.message}`);
      skipped.push(entry.userId);
    }
  }

  console.log(`\n✅ Terminé — ${inserted} inséré(s), ${updated} déjà présent(s), ${skipped.length} erreur(s)`);
  if (skipped.length) console.log("Erreurs :", skipped);

  await client.destroy();
  process.exit(0);
});

client.login(token);
