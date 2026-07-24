const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

if (!config.discordToken || !config.clientId) {
  console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in .env file!');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command.data && command.execute) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    console.log(`⏳ Started refreshing ${commands.length} application (/) commands...`);

    let data;
    if (config.guildId) {
      // Register to test server (instant)
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded ${data.length} guild slash commands!`);
    } else {
      // Register globally
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded ${data.length} global slash commands!`);
    }
  } catch (error) {
    console.error('❌ Error deploying slash commands:', error);
  }
})();
