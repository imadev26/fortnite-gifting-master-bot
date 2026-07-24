const { EmbedBuilder } = require('discord.js');

/**
 * Formats Fortnite Battle Royale News into Discord Embeds
 */
function createNewsEmbeds(newsData) {
  const motds = newsData.motds || newsData.messages || [];

  if (!motds.length) {
    return [
      new EmbedBuilder()
        .setTitle('📰 Fortnite News')
        .setDescription('No news items found.')
        .setColor(0x5865f2),
    ];
  }

  // Create an embed for up to 3 top news items
  return motds.slice(0, 3).map((item, index) => {
    const embed = new EmbedBuilder()
      .setTitle(`📰 ${item.title || 'Fortnite Update'}`)
      .setDescription(item.body || 'New Fortnite update is live!')
      .setColor(0xff9900)
      .setFooter({ text: `Fortnite News • Item ${index + 1} of ${Math.min(motds.length, 3)}` });

    if (item.image) {
      embed.setImage(item.image);
    }

    return embed;
  });
}

module.exports = {
  createNewsEmbeds,
};
