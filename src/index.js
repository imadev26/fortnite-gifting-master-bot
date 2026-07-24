const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Load Telegram Bot if token exists
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    require('./telegram');
    console.log('🤖 Telegram Bot module initialized!');
  } catch (err) {
    console.error('Error starting Telegram bot:', err);
  }
}

if (!config.discordToken) {
  console.log('⚠️ DISCORD_TOKEN is empty in .env. Skipping Discord bot startup.');
} else {
  // Create Client instance
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  client.commands = new Collection();

  // Load Commands dynamically
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }

  // Event: Ready
  client.once('ready', (c) => {
    console.log(`🚀 Fortnite Discord Bot is online as ${c.user.tag}!`);
    c.user.setActivity('Fortnite | /shop & /gift', { type: 3 });
  });

  // Event: Interaction Create (Slash Commands)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      const errorMessage = {
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  });

  client.login(config.discordToken);
}
