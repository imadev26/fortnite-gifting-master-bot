const { SlashCommandBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');
const { createStatsEmbed } = require('../embeds/statsEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Look up Fortnite Battle Royale player stats')
    .addStringOption((option) =>
      option
        .setName('username')
        .setDescription('The Epic Games username of the player')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('platform')
        .setDescription('Account platform')
        .setRequired(false)
        .addChoices(
          { name: 'Epic Games', value: 'epic' },
          { name: 'PlayStation (PSN)', value: 'psn' },
          { name: 'Xbox Live', value: 'xbl' }
        )
    ),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    const platform = interaction.options.getString('platform') || 'epic';

    await interaction.deferReply();

    const res = await FortniteApiService.getStats(username, platform);

    if (!res.success) {
      return interaction.editReply({
        content: `❌ Could not find stats for **${username}** (${platform.toUpperCase()}).\n*Reason: ${res.error}*`,
      });
    }

    const embed = createStatsEmbed(res.data);
    await interaction.editReply({ embeds: [embed] });
  },
};
