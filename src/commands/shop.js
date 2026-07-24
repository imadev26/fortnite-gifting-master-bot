const { SlashCommandBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');
const { createShopPageEmbed } = require('../embeds/shopEmbed');

// Cache shop response to reduce API load (10 minutes cache)
let shopCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Displays the current Fortnite Item Shop'),

  async execute(interaction) {
    await interaction.deferReply();

    const now = Date.now();
    if (!shopCache || now - lastFetchTime > CACHE_DURATION) {
      const res = await FortniteApiService.getShop();
      if (!res.success) {
        return interaction.editReply({
          content: `❌ Error fetching shop: ${res.error}`,
        });
      }
      shopCache = res.data;
      lastFetchTime = now;
    }

    const { embeds, components } = createShopPageEmbed(shopCache, 0);

    const message = await interaction.editReply({
      embeds,
      components,
    });

    // Create a component collector for pagination
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000, // 2 minutes
    });

    collector.on('collect', async (i) => {
      const parts = i.customId.split('_');
      const action = parts[1]; // 'prev' or 'next'
      const currentPage = parseInt(parts[2], 10);

      const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;
      const updated = createShopPageEmbed(shopCache, newPage);

      await i.update({
        embeds: updated.embeds,
        components: updated.components,
      });
    });

    collector.on('end', async () => {
      // Disable buttons on timeout
      try {
        await interaction.editReply({ components: [] });
      } catch (err) {
        // Ignored if message was deleted
      }
    });
  },
};
