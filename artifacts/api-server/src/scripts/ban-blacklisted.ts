/**
 * Script one-shot : banne tous les utilisateurs de la blacklist globale DB
 * sur l'ensemble des serveurs gérés par le bot, s'ils n'y sont pas déjà bannis.
 *
 * Usage : pnpm --filter @workspace/api-server run ban-blacklisted
 */
import { Client, GatewayIntentBits } from "discord.js";
import { db, globalBlacklistTable } from "@workspace/db";

const token = process.env["DISCORD_TOKEN"];
if (!token) { console.error("DISCORD_TOKEN manquant"); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async (readyClient) => {
  console.log(`Connecté en tant que ${readyClient.user.tag}`);

  const rows = await db.select().from(globalBlacklistTable);
  console.log(`${rows.length} utilisateur(s) en blacklist globale`);

  for (const row of rows) {
    console.log(`\nTraitement de ${row.userTag} (${row.userId})…`);
    for (const [, guild] of readyClient.guilds.cache) {
      try {
        // Vérifie si déjà banni
        const existingBan = await guild.bans.fetch(row.userId).catch(() => null);
        if (existingBan) {
          console.log(`  [${guild.name}] Déjà banni — skip`);
          continue;
        }
        await guild.bans.create(row.userId, {
          reason: `[GLOBAL BLACKLIST] ${row.reason} — blacklisté par ${row.moderatorTag}`,
        });
        console.log(`  [${guild.name}] ✓ Banni`);
      } catch (e: any) {
        if (e.code === 10013) {
          console.log(`  [${guild.name}] Utilisateur inconnu — skip`);
        } else {
          console.error(`  [${guild.name}] ✗ Erreur: ${e.message}`);
        }
      }
    }
  }

  console.log("\n✅ Terminé");
  await client.destroy();
  process.exit(0);
});

client.login(token);
