const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EpicAuthService = require('../services/epicAuthService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accounts')
    .setDescription('Lists all saved Epic Games accounts available for gifting'),

  async execute(interaction) {
    const accounts = EpicAuthService.getAccounts();

    if (!accounts || accounts.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📂 Linked Epic Games Accounts')
        .setDescription('No Epic accounts linked yet.\n\nUse `/addaccount` to link your first account!')
        .setColor(0xff9900);

      return interaction.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📂 Saved Gifting Accounts (${accounts.length})`)
      .setColor(0x00d2ff)
      .setDescription('List of active Epic accounts stored for direct gifting:')
      .setFooter({ text: 'Fortnite Bot • DeviceAuth Account Manager' })
      .setTimestamp();

    accounts.forEach((acc, idx) => {
      embed.addFields({
        name: `${idx + 1}. ${acc.displayName}`,
        value: `ID: \`${acc.accountId}\` • Added: \`${acc.addedAt.split('T')[0]}\``,
        inline: false,
      });
    });

    await interaction.reply({ embeds: [embed] });
  },
};
