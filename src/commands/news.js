const { SlashCommandBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');
const { createNewsEmbeds } = require('../embeds/newsEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Fetches the latest Battle Royale news and updates'),

  async execute(interaction) {
    await interaction.deferReply();

    const res = await FortniteApiService.getNews();

    if (!res.success) {
      return interaction.editReply({
        content: `❌ Error fetching news: ${res.error}`,
      });
    }

    const embeds = createNewsEmbeds(res.data);
    await interaction.editReply({ embeds });
  },
};
