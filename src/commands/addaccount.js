const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EpicAuthService = require('../services/epicAuthService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addaccount')
    .setDescription('Link an Epic Games Account to the bot via DeviceAuth for gifting')
    .addStringOption((option) =>
      option
        .setName('code')
        .setDescription('Paste your 32-character authorization code from Epic Games')
        .setRequired(false)
    ),

  async execute(interaction) {
    const code = interaction.options.getString('code');
    const authUrl = EpicAuthService.getAuthUrl();

    if (!code) {
      const embed = new EmbedBuilder()
        .setTitle('🔑 Add Epic Games Account (Device Authorization)')
        .setDescription(
          'To link your Epic Games account for gifting, follow these 2 simple steps:\n\n' +
            `1. **[Click here to log into Epic Games](${authUrl})** in your browser.\n` +
            '2. Copy the 32-character **`authorizationCode`** from the page JSON response.\n' +
            '3. Run `/addaccount code: <your_copied_code>` to complete device auth setup.'
        )
        .setColor(0x00d2ff)
        .setFooter({ text: 'DeviceAuth is stored securely in data/accounts.json' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const res = await EpicAuthService.createDeviceAuthFromCode(code);

    if (!res.success) {
      return interaction.editReply({
        content: `❌ Failed to link Epic Games account: **${res.error}**\n\n*Make sure you used a fresh code from: [Epic Auth Link](${authUrl})*`,
      });
    }

    const account = res.account;

    const embed = new EmbedBuilder()
      .setTitle('✅ Epic Games Account Linked!')
      .setDescription(`Successfully linked account **${account.displayName}** (\`${account.accountId}\`)!`)
      .setColor(0x00ff7f)
      .addFields(
        { name: '👤 Display Name', value: `**${account.displayName}**`, inline: true },
        { name: '📅 Date Added', value: `\`${account.addedAt.split('T')[0]}\``, inline: true }
      )
      .setFooter({ text: 'Account saved for gifting • Fortnite Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
