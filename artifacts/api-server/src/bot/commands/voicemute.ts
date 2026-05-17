import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
  Message,
} from "discord.js";
import { sendLog } from "../log.js";

const DURATIONS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "10m": 600_000, "30m": 1_800_000,
  "1h": 3_600_000, "6h": 21_600_000, "12h": 43_200_000, "1j": 86_400_000,
};

const LABELS: Record<string, string> = {
  "1m": "1 minute", "5m": "5 minutes", "10m": "10 minutes", "30m": "30 minutes",
  "1h": "1 heure", "6h": "6 heures", "12h": "12 heures", "1j": "1 jour",
};

const activeVoiceMutes = new Map<string, ReturnType<typeof setTimeout>>();

async function applyVoiceMute(
  client: Parameters<typeof sendLog>[0],
  target: GuildMember,
  durationMs: number,
  durationLabel: string,
  reason: string,
  moderator: GuildMember,
): Promise<void> {
  await target.voice.setMute(true, reason).catch(() => null);
  await target.voice.setDeaf(true, reason).catch(() => null);

  await sendLog(client, new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("🎙️ Mute vocal appliqué")
    .setThumbnail(target.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
      { name: "Modérateur", value: `${moderator.user.tag}`, inline: true },
      { name: "Durée", value: durationLabel, inline: true },
      { name: "Expire", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
      { name: "Raison", value: reason },
    )
    .setTimestamp(), { guildId: target.guild.id });

  const key = `${target.guild.id}:${target.id}`;
  const existing = activeVoiceMutes.get(key);
  if (existing) clearTimeout(existing);

  const tid = setTimeout(async () => {
    activeVoiceMutes.delete(key);
    const refreshed = await target.guild.members.fetch(target.id).catch(() => null);
    if (!refreshed) return;
    await refreshed.voice.setMute(false).catch(() => null);
    await refreshed.voice.setDeaf(false).catch(() => null);
    await sendLog(client, new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🎙️ Mute vocal retiré")
      .setThumbnail(refreshed.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${refreshed.user.tag} (\`${refreshed.id}\`)`, inline: true },
        { name: "Raison", value: "Durée expirée", inline: true },
      )
      .setTimestamp(), { guildId: target.guild.id });
  }, durationMs);

  activeVoiceMutes.set(key, tid);
}

export const data = new SlashCommandBuilder()
  .setName("voicemute")
  .setDescription("Coupe le micro et le casque d'un membre en vocal pour une durée choisie")
  .addUserOption((o) =>
    o.setName("membre").setDescription("Le membre à muter vocalement").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("durée").setDescription("Durée du mute vocal").setRequired(true)
      .addChoices(
        { name: "1 minute", value: "1m" }, { name: "5 minutes", value: "5m" },
        { name: "10 minutes", value: "10m" }, { name: "30 minutes", value: "30m" },
        { name: "1 heure", value: "1h" }, { name: "6 heures", value: "6h" },
        { name: "12 heures", value: "12h" }, { name: "1 jour", value: "1j" },
      )
  )
  .addStringOption((o) => o.setName("raison").setDescription("Raison du mute vocal"))
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return interaction.reply({ content: "Serveur uniquement.", ephemeral: true });

  const target = interaction.options.getMember("membre") as GuildMember | null;
  const durKey = interaction.options.getString("durée", true);
  const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
  const moderator = interaction.member as GuildMember;

  if (!target) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
  if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Tu ne peux pas te muter toi-même.", ephemeral: true });
  if (!target.voice.channel) return interaction.reply({ content: "❌ Ce membre n'est pas dans un salon vocal.", ephemeral: true });
  if (target.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Impossible de muter un administrateur.", ephemeral: true });

  const durationMs = DURATIONS[durKey]!;
  const durationLabel = LABELS[durKey]!;

  await applyVoiceMute(interaction.client, target, durationMs, durationLabel, reason, moderator);

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle("🎙️ Mute vocal appliqué")
      .addFields(
        { name: "Membre", value: `${target.user.tag}`, inline: true },
        { name: "Durée", value: durationLabel, inline: true },
        { name: "Expire", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
        { name: "Raison", value: reason },
      )
      .setTimestamp()],
  });
}

export const prefixName = "voicemute";
export const prefixAliases = ["vmute", "vcmute"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
    await message.reply("❌ Permission insuffisante (Désactiver le micro des membres requis)."); return;
  }

  const rawTarget = args[0];
  const durKey = args[1]?.toLowerCase();
  const reason = args.slice(2).join(" ") || "Aucune raison fournie";

  if (!rawTarget || !durKey) {
    await message.reply("❌ Usage : `&voicemute @membre durée [raison]`\nDurées : `1m 5m 10m 30m 1h 6h 12h 1j`"); return;
  }

  if (!DURATIONS[durKey]) {
    await message.reply("❌ Durée invalide. Options : `1m 5m 10m 30m 1h 6h 12h 1j`"); return;
  }

  const targetId = rawTarget.replace(/[<@!>]/g, "");
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) { await message.reply("❌ Membre introuvable."); return; }
  if (!target.voice.channel) { await message.reply("❌ Ce membre n'est pas dans un salon vocal."); return; }
  if (target.permissions.has(PermissionFlagsBits.Administrator)) { await message.reply("❌ Impossible de muter un administrateur."); return; }

  const durationMs = DURATIONS[durKey]!;
  const durationLabel = LABELS[durKey]!;

  await applyVoiceMute(message.client, target, durationMs, durationLabel, reason, message.member);

  await message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle("🎙️ Mute vocal appliqué")
      .addFields(
        { name: "Membre", value: `${target.user.tag}`, inline: true },
        { name: "Durée", value: durationLabel, inline: true },
        { name: "Expire", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
        { name: "Raison", value: reason },
      )
      .setTimestamp()],
  });
}
