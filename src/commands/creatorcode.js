const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creatorcode')
    .setDescription('Check if a Support-A-Creator code is valid and view owner details')
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('Support-A-Creator code (e.g. Ninja, Lachlan)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const codeQuery = interaction.options.getString('code');
    await interaction.deferReply();

    const res = await FortniteApiService.getCreatorCode(codeQuery);

    if (!res.success || !res.data) {
      return interaction.editReply({
        content: `❌ Support-A-Creator code **${codeQuery}** was not found or is currently inactive.`,
      });
    }

    const creator = res.data;
    const code = creator.code || codeQuery;
    const accountName = creator.account?.name || 'Owner';
    const status = creator.status === 'ACTIVE' ? '✅ ACTIVE' : '❌ INACTIVE';

    const embed = new EmbedBuilder()
      .setTitle(`🌟 Support-A-Creator Code: ${code}`)
      .setColor(0x00ff7f)
      .addFields(
        { name: '👤 Account Owner', value: `**${accountName}**`, inline: true },
        { name: '⚡ Status', value: `**${status}**`, inline: true }
      )
      .setFooter({ text: 'Use code f l-Item Shop! • Fortnite API' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
