const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays interactive help menu for all Fortnite Bot commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎮 Fortnite Bot - Interactive Help Menu')
      .setDescription(
        'Welcome to the ultimate Fortnite Discord Bot! Powered by `Fortnite-API.com`.\n\nUse the dropdown menu below or type any of the slash commands:'
      )
      .setColor(0x00d2ff)
      .addFields(
        { name: '🛒 `/shop`', value: 'View current Fortnite Item Shop with prices, rarities & pagination buttons.', inline: false },
        { name: '🏆 `/stats <name>`', value: 'Look up player lifetime/season stats (Wins, K/D, Matches, BP Level).', inline: false },
        { name: '✨ `/cosmetic <name>`', value: 'Search any Fortnite skin, emote, or pickaxe details & preview.', inline: false },
        { name: '🗺️ `/map`', value: 'View current Battle Royale map with POIs.', inline: false },
        { name: '📰 `/news`', value: 'Check latest Battle Royale news and update banners.', inline: false },
        { name: '🔑 `/aes`', value: 'Check current patch build and encryption AES keys.', inline: false },
        { name: '🌟 `/creatorcode <code>`', value: 'Verify Support-A-Creator code details.', inline: false }
      )
      .setFooter({ text: 'Fortnite Bot v1.0 • All API Features Enabled' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
