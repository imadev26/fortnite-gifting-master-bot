require('dotenv').config();

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  fortniteApiKey: process.env.FORTNITE_API_KEY || '',
  fortniteApiBaseUrl: 'https://fortnite-api.com/v2',
};
