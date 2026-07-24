const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Displays the current Fortnite Battle Royale map'),

  async execute(interaction) {
    await interaction.deferReply();

    const res = await FortniteApiService.getMap();

    if (!res.success || !res.data?.images?.pois) {
      return interaction.editReply({
        content: `❌ Error fetching Fortnite map: ${res.error || 'Map unavailable'}`,
      });
    }

    const mapImage = res.data.images.pois || res.data.images.blank;

    const embed = new EmbedBuilder()
      .setTitle('🗺️ Fortnite Battle Royale Map')
      .setDescription('Current Chapter / Season Map with POIs (Points of Interest)')
      .setColor(0x00d2ff)
      .setImage(mapImage)
      .setFooter({ text: 'Fortnite API • Map Update' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
