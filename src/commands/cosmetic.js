const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');
const { getRarityColor } = require('../embeds/shopEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cosmetic')
    .setDescription('Search for any Fortnite Skin, Pickaxe, Emote, or Backbling')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Name of the item (e.g. Renegade Raider, Leviathan Axe, Griddy)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('name');
    await interaction.deferReply();

    const res = await FortniteApiService.searchCosmetic(query);

    if (!res.success || !res.data) {
      return interaction.editReply({
        content: `❌ Could not find any cosmetic matching "**${query}**".`,
      });
    }

    const item = res.data;
    const name = item.name || 'Cosmetic Item';
    const description = item.description || 'No description available.';
    const type = item.type?.displayValue || 'Cosmetic';
    const rarity = item.rarity?.displayValue || item.rarity?.value || 'Common';
    const chapterSeason = item.introduction?.text || 'Unknown Season';
    const imageUrl = item.images?.featured || item.images?.icon || item.images?.smallIcon;

    const embed = new EmbedBuilder()
      .setTitle(`✨ ${name} (${type})`)
      .setDescription(`*${description}*`)
      .setColor(getRarityColor(item.rarity?.value))
      .addFields(
        { name: '💎 Rarity', value: `**${rarity}**`, inline: true },
        { name: '📅 Introduced', value: `**${chapterSeason}**`, inline: true }
      )
      .setFooter({ text: `ID: ${item.id} • Fortnite API` })
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
