const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const FortniteApiService = require('../services/fortniteApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aes')
    .setDescription('Displays current Fortnite patch build and AES encryption keys'),

  async execute(interaction) {
    await interaction.deferReply();

    const res = await FortniteApiService.getAes();

    if (!res.success || !res.data) {
      return interaction.editReply({
        content: `❌ Error fetching AES keys: ${res.error}`,
      });
    }

    const data = res.data;
    const mainKey = data.mainKey || 'N/A';
    const build = data.build || 'Latest Patch';
    const dynamicKeysCount = data.dynamicKeys ? data.dynamicKeys.length : 0;

    const embed = new EmbedBuilder()
      .setTitle('🔑 Fortnite AES Keys & Build')
      .setColor(0x9b59b6)
      .addFields(
        { name: '📦 Patch Build', value: `\`${build}\``, inline: false },
        { name: '🔑 Main Key', value: `\`\`\`${mainKey}\`\`\``, inline: false },
        { name: '📂 Dynamic Keys Count', value: `**${dynamicKeysCount} keys**`, inline: true }
      )
      .setFooter({ text: 'Fortnite API • Datamining & Patch Info' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
