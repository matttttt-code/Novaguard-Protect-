import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  ChannelType,
} from "discord.js";
import { setTicketStaffRole, setTicketCategory, getConfig } from "../guild-config-store.js";

export const data = new SlashCommandBuilder()
  .setName("ticketconfig")
  .setDescription("Configure le système de tickets")
  .addSubcommand((sub) =>
    sub.setName("role")
      .setDescription("Définit le rôle staff qui peut voir les tickets")
      .addRoleOption((o) => o.setName("role").setDescription("Rôle du staff").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub.setName("categorie")
      .setDescription("Définit la catégorie où seront créés les tickets")
      .addChannelOption((o) =>
        o.setName("categorie").setDescription("Catégorie Discord").setRequired(true)
          .addChannelTypes(ChannelType.GuildCategory)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("voir").setDescription("Affiche la configuration actuelle des tickets")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Commande serveur uniquement.", ephemeral: true });

  const sub = interaction.options.getSubcommand();

  if (sub === "role") {
    const role = interaction.options.getRole("role", true);
    setTicketStaffRole(interaction.guildId, role.id);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("✅ Rôle staff tickets configuré")
        .addFields({ name: "Rôle", value: `<@&${role.id}>`, inline: true }).setTimestamp()],
    });
  }

  if (sub === "categorie") {
    const cat = interaction.options.getChannel("categorie", true);
    setTicketCategory(interaction.guildId, cat.id);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("✅ Catégorie tickets configurée")
        .addFields({ name: "Catégorie", value: cat.name ?? cat.id, inline: true }).setTimestamp()],
    });
  }

  if (sub === "voir") {
    const config = getConfig(interaction.guildId!);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("⚙️ Config — Tickets")
        .addFields(
          { name: "Rôle staff", value: config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "Non configuré", inline: true },
          { name: "Catégorie", value: config.ticketCategoryId ? `\`${config.ticketCategoryId}\`` : "Non configurée", inline: true },
        ).setFooter({ text: "Utilisez /ticketpanel pour créer le panel dans un salon." }).setTimestamp()],
      ephemeral: true,
    });
  }

  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

export const prefixName = "ticketconfig";
export const prefixAliases = ["tconfig"];

export async function executeMessage(message: Message, args: string[]) {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Permission insuffisante (Administrateur requis)."); return;
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "role") {
    const roleId = args[1]?.replace(/[<@&>]/g, "");
    if (!roleId) { await message.reply("Usage : `&ticketconfig role @role`"); return; }
    const role = message.guild.roles.cache.get(roleId);
    if (!role) { await message.reply("❌ Rôle introuvable."); return; }
    setTicketStaffRole(message.guild.id, role.id);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("✅ Rôle staff tickets configuré")
      .addFields({ name: "Rôle", value: `<@&${role.id}>`, inline: true }).setTimestamp()] });
    return;
  }

  if (sub === "categorie") {
    const catId = args[1]?.replace(/[<#>]/g, "");
    if (!catId) { await message.reply("Usage : `&ticketconfig categorie <categoryId>`"); return; }
    const cat = message.guild.channels.cache.get(catId);
    if (!cat || cat.type !== ChannelType.GuildCategory) { await message.reply("❌ Catégorie introuvable."); return; }
    setTicketCategory(message.guild.id, catId);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("✅ Catégorie tickets configurée")
      .addFields({ name: "Catégorie", value: cat.name, inline: true }).setTimestamp()] });
    return;
  }

  if (sub === "voir") {
    const config = getConfig(message.guild.id);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x6366f1).setTitle("⚙️ Config — Tickets")
      .addFields(
        { name: "Rôle staff", value: config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : "Non configuré", inline: true },
        { name: "Catégorie", value: config.ticketCategoryId ? `\`${config.ticketCategoryId}\`` : "Non configurée", inline: true },
      ).setTimestamp()] });
    return;
  }

  await message.reply("Usage : `&ticketconfig role @role` | `&ticketconfig categorie <id>` | `&ticketconfig voir`");
}
