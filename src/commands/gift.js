const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EpicAuthService = require('../services/epicAuthService');
const GiftingService = require('../services/giftingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Directly gift a Fortnite shop item to any Epic Games player')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('Name of the item in the current Fortnite shop')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('recipient')
        .setDescription('Epic Games display name of the recipient')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Personal gift message')
        .setRequired(false)
    ),

  async execute(interaction) {
    const item = interaction.options.getString('item');
    const recipient = interaction.options.getString('recipient');
    const message = interaction.options.getString('message') || 'Enjoy your Fortnite gift!';

    await interaction.deferReply();

    const accounts = EpicAuthService.getAccounts();

    if (!accounts || accounts.length === 0) {
      return interaction.editReply({
        content: '❌ No Epic Games accounts found! Use `/addaccount` first to link a gifting account.',
      });
    }

    const senderAccount = accounts[0]; // Uses first available account

    const result = await GiftingService.giftItemToUser(senderAccount, recipient, item, message);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ **Gifting Failed:** ${result.error}`,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎁 Gift Sent Successfully!')
      .setColor(0x00ff7f)
      .setDescription(`Successfully sent **${result.item}** to **${result.recipient}**!`)
      .addFields(
        { name: '📦 Item', value: `**${result.item}**`, inline: true },
        { name: '💰 Price', value: `**${result.price} V-Bucks**`, inline: true },
        { name: '👤 Sender Account', value: `**${result.sender}**`, inline: true },
        { name: '✉️ Gift Message', value: `*${message}*`, inline: false }
      )
      .setFooter({ text: 'Fortnite Game Client API • Direct Gift' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
