const { EmbedBuilder } = require('discord.js');

/**
 * Formats Fortnite Player Stats into a sleek Discord Embed
 */
function createStatsEmbed(data) {
  const account = data.account || {};
  const stats = data.stats?.all?.overall || {};
  const battlePass = data.battlePass || {};

  const name = account.name || 'Fortnite Player';
  const wins = stats.wins !== undefined ? stats.wins.toLocaleString() : '0';
  const kills = stats.kills !== undefined ? stats.kills.toLocaleString() : '0';
  const kd = stats.kd !== undefined ? stats.kd.toFixed(2) : '0.00';
  const winRate = stats.winRate !== undefined ? `${stats.winRate.toFixed(1)}%` : '0%';
  const matches = stats.matches !== undefined ? stats.matches.toLocaleString() : '0';
  const bpLevel = battlePass.level !== undefined ? battlePass.level : 'N/A';

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Fortnite Stats for ${name}`)
    .setColor(0x00ff7f)
    .setDescription(`Overall Battle Royale Lifetime Statistics`)
    .addFields(
      { name: '👑 Wins', value: `**${wins}**`, inline: true },
      { name: '⚔️ Kills', value: `**${kills}**`, inline: true },
      { name: '🎯 K/D Ratio', value: `**${kd}**`, inline: true },
      { name: '📊 Win Rate', value: `**${winRate}**`, inline: true },
      { name: '🎮 Matches Played', value: `**${matches}**`, inline: true },
      { name: '⭐ BP Level', value: `**${bpLevel}**`, inline: true }
    )
    .setFooter({ text: 'Powered by Fortnite-API.com • Fortnite Stats' })
    .setTimestamp();

  // If fortnite-api.com generated an all-in-one image stat card
  if (data.image) {
    embed.setImage(data.image);
  }

  return embed;
}

module.exports = {
  createStatsEmbed,
};
