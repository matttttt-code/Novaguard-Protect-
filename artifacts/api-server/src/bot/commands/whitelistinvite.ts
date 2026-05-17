import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { getConfig, addWhitelistedInvite, removeWhitelistedInvite } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("whitelistinvite")
  .setDescription("Protège des codes d'invitation contre toute révocation (irrévocables)")
  .addSubcommand((s) =>
    s.setName("ajouter")
      .setDescription("Protège un code d'invitation")
      .addStringOption((o) => o.setName("code").setDescription("Code d'invitation (ex: abc123)").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("retirer")
      .setDescription("Retire la protection d'un code")
      .addStringOption((o) => o.setName("code").setDescription("Code d'invitation").setRequired(true))
  )
  .addSubcommand((s) => s.setName("liste").setDescription("Affiche les invitations protégées"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "❌ Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === "ajouter") {
    const code = interaction.options.getString("code", true).trim().replace(/https?:\/\/discord\.gg\//i, "");
    addWhitelistedInvite(guildId, code);
    return interaction.reply({ content: `✅ Invitation \`${code}\` **protégée** — elle ne sera plus révoquée par les commandes de modération.`, ephemeral: true });
  }

  if (sub === "retirer") {
    const code = interaction.options.getString("code", true).trim().replace(/https?:\/\/discord\.gg\//i, "");
    const removed = removeWhitelistedInvite(guildId, code);
    return interaction.reply({ content: removed ? `✅ Protection retirée pour \`${code}\`.` : `❌ Code \`${code}\` introuvable dans la liste blanche.`, ephemeral: true });
  }

  if (sub === "liste") {
    const codes = getConfig(guildId).whitelistedInviteCodes;
    if (codes.length === 0) {
      return interaction.reply({ content: "ℹ️ Aucune invitation protégée.", ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle(`🛡️ Invitations protégées — ${codes.length}`)
      .setDescription(codes.map((c) => `• \`${c}\` — https://discord.gg/${c}`).join("\n"))
      .setFooter({ text: "Ces invitations ne seront pas révoquées par /revokeinvites ou &revokeinvites" })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "whitelistinvite";
export const prefixAliases = ["wlinv", "invitewhitelist", "protegeinvite"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply("❌ Permission insuffisante (ManageGuild requis)."); return;
  }

  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;

  if (sub === "ajouter") {
    const code = args[1]?.trim().replace(/https?:\/\/discord\.gg\//i, "");
    if (!code) { await message.reply("Usage : `&whitelistinvite ajouter <code>`"); return; }
    addWhitelistedInvite(guildId, code);
    await message.reply(`✅ Invitation \`${code}\` **protégée**.`); return;
  }
  if (sub === "retirer") {
    const code = args[1]?.trim().replace(/https?:\/\/discord\.gg\//i, "");
    if (!code) { await message.reply("Usage : `&whitelistinvite retirer <code>`"); return; }
    const removed = removeWhitelistedInvite(guildId, code);
    await message.reply(removed ? `✅ Protection retirée pour \`${code}\`.` : `❌ Code \`${code}\` introuvable.`); return;
  }
  if (sub === "liste") {
    const codes = getConfig(guildId).whitelistedInviteCodes;
    if (codes.length === 0) { await message.reply("ℹ️ Aucune invitation protégée."); return; }
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle(`🛡️ Invitations protégées — ${codes.length}`).setDescription(codes.map((c) => `• \`${c}\``).join("\n")).setTimestamp()] });
    return;
  }
  await message.reply("Sous-commandes : `ajouter <code>`, `retirer <code>`, `liste`");
}
