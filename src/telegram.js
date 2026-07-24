const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const FortniteApiService = require('./services/fortniteApi');
const EpicAuthService = require('./services/epicAuthService');
const GiftingService = require('./services/giftingService');
const EpicAccountService = require('./services/epicAccountService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('⚠️ TELEGRAM_BOT_TOKEN is empty f .env!');
  module.exports = null;
  return;
}

const bot = new Telegraf(token);

// Cache shop for Telegram pagination
let tgShopCache = null;

function buildShopMessage(shopData, pageIndex = 0, itemsPerPage = 5) {
  const entries = shopData.entries || [];
  const totalPages = Math.ceil(entries.length / itemsPerPage);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = currentPage * itemsPerPage;
  const pageEntries = entries.slice(start, start + itemsPerPage);

  let text = `🛒 *FORTNITE DAILY ITEM SHOP*\n`;
  text += `📅 Date: *${shopData.date ? shopData.date.split('T')[0] : 'Today'}* • Offers: *${entries.length}*\n\n`;

  pageEntries.forEach((entry, idx) => {
    let itemName = 'Special Offer';
    let rarity = 'Cosmetic';
    if (entry.items && entry.items[0]) {
      itemName = entry.items[0].name || itemName;
      rarity = entry.items[0].rarity?.displayValue || entry.items[0].rarity?.value || rarity;
    } else if (entry.tracks && entry.tracks[0]) {
      itemName = `🎵 ${entry.tracks[0].title}`;
      rarity = 'Jam Track';
    } else if (entry.bundle) {
      itemName = `📦 ${entry.bundle.name}`;
      rarity = 'Bundle';
    }

    const price = entry.finalPrice || entry.regularPrice || 'N/A';
    text += `*${start + idx + 1}. ${itemName}* (${rarity})\n💰 Price: *${price} V-Bucks*\n\n`;
  });

  text += ` Page *${currentPage + 1}* of *${totalPages}*`;

  const buttons = [];
  if (currentPage > 0) {
    buttons.push(Markup.button.callback('◀ Previous', `tgshop_prev_${currentPage}`));
  }
  if (currentPage < totalPages - 1) {
    buttons.push(Markup.button.callback('Next ▶', `tgshop_next_${currentPage}`));
  }

  const keyboard = buttons.length ? Markup.inlineKeyboard([buttons]) : null;

  return { text, keyboard };
}

// 1. Command: /start & /help
bot.start((ctx) => {
  const welcomeText =
    `🎮 *WELCOME TO ZERKSHOP FORTNITE BOT*\n\n` +
    `Use the keyboard menu below or type any command:\n\n` +
    `🔑 */login* - Login into your account (DeviceAuth)\n` +
    `📂 */accounts* - Select or list accounts\n` +
    `💳 */vbucks* - Check V-Bucks balance\n` +
    `🛒 */shop* - Current Item Shop\n` +
    `🎁 */buy* - Buy or Gift something from shop\n` +
    `📊 */gifts* - Gift send count in 24h & limits\n` +
    `👥 */friend <username>* - Add Epic Games friend\n` +
    `🗑️ */remove* - Remove a stored account\n` +
    `⚙️ */settings* - Account settings & SAC Code`;

  return ctx.replyWithMarkdown(
    welcomeText,
    Markup.keyboard([
      ['🛒 /shop', '💳 /vbucks'],
      ['🎁 /buy', '📊 /gifts'],
      ['🔑 /login', '📂 /accounts'],
      ['👥 /friend', '⚙️ /settings'],
    ]).resize()
  );
});

bot.help((ctx) => ctx.start());

// 2. Command: /login & '🔑 /login'
const handleLoginPrompt = async (ctx) => {
  const authUrl = EpicAuthService.getAuthUrl();
  const text =
    `🔑 *LOGIN INTO YOUR EPIC GAMES ACCOUNT*\n\n` +
    `1. Click the link below to log into Epic Games.\n` +
    `2. Copy the 32-character *authorizationCode* from the browser.\n` +
    `3. Reply here using: \`/code <your_authorization_code>\``;

  return ctx.replyWithMarkdown(
    text,
    Markup.inlineKeyboard([[Markup.button.url('🔑 Log In to Epic Games', authUrl)]])
  );
};

bot.command('login', handleLoginPrompt);
bot.hears('🔑 /login', handleLoginPrompt);

// Sub-command: /code <code>
bot.command('code', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length) {
    return ctx.reply('⚠️ Usage: /code <your_32_character_authorization_code>');
  }

  const code = args[0];
  ctx.reply('⏳ Authenticating with Epic Games and generating DeviceAuth...');

  const res = await EpicAuthService.createDeviceAuthFromCode(code);
  if (!res.success) {
    return ctx.reply(`❌ Failed to link Epic account: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `✅ *EPIC GAMES ACCOUNT LINKED!*\n\n` +
      `👤 Display Name: *${res.account.displayName}*\n` +
      `🆔 Account ID: \`${res.account.accountId}\`\n` +
      `📅 Added: \`${res.account.addedAt.split('T')[0]}\``
  );
});

// 3. Command: /accounts & '📂 /accounts'
const handleAccounts = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('📂 No Epic Games accounts stored yet. Use /login to add an account!');
  }

  let text = `📂 *SELECT AN EPIC GAMES ACCOUNT (${accounts.length})*\n\n`;
  const buttons = [];

  accounts.forEach((acc, idx) => {
    text += `${idx + 1}. *${acc.displayName}*\n   ID: \`${acc.accountId}\`\n\n`;
    buttons.push([
      Markup.button.callback(`💳 V-Bucks: ${acc.displayName}`, `acc_vbucks_${acc.accountId}`),
      Markup.button.callback(`🗑️ Remove`, `acc_rm_${acc.accountId}`),
    ]);
  });

  return ctx.replyWithMarkdown(text, Markup.inlineKeyboard(buttons));
};

bot.command('accounts', handleAccounts);
bot.hears('📂 /accounts', handleAccounts);

// 4. Command: /vbucks & '💳 /vbucks'
const handleVBucks = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  ctx.reply(`⏳ Querying live V-Bucks balance for *${accounts[0].displayName}*...`, { parse_mode: 'Markdown' });

  const res = await EpicAccountService.getVBucksBalance(accounts[0]);
  if (!res.success) {
    return ctx.reply(`❌ Error fetching V-Bucks: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `💳 *YOUR V-BUCKS BALANCE*\n\n` +
      `👤 Account: *${res.displayName}*\n` +
      `💰 Current Balance: *${res.balance.toLocaleString()} V-Bucks*`
  );
};

bot.command('vbucks', handleVBucks);
bot.hears('💳 /vbucks', handleVBucks);

// Inline action: V-Bucks callback
bot.action(/acc_vbucks_(.+)/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);

  if (!acc) return ctx.answerCbQuery('Account not found.');

  ctx.answerCbQuery('Querying V-Bucks...');
  const res = await EpicAccountService.getVBucksBalance(acc);
  if (!res.success) return ctx.reply(`❌ Error: ${res.error}`);

  return ctx.replyWithMarkdown(`💳 *${acc.displayName}* has *${res.balance.toLocaleString()} V-Bucks*`);
});

// 5. Command: /gifts & '📊 /gifts'
const handleGiftsStats = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  ctx.reply(`⏳ Checking 24-hour gifting stats for *${accounts[0].displayName}*...`, { parse_mode: 'Markdown' });

  const res = await EpicAccountService.getGiftingStats(accounts[0]);
  if (!res.success) {
    return ctx.reply(`❌ Error: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `📊 *24-HOUR GIFTING STATUS*\n\n` +
      `👤 Account: *${res.displayName}*\n` +
      `🎁 Gifts Sent in 24h: *${res.sent} / ${res.max}*\n` +
      `⚡ Remaining Gifts Available: *${res.remaining} gifts*\n\n` +
      `*Note: Fortnite allows a maximum of 5 gifts per 24 hours per account.*`
  );
};

bot.command('gifts', handleGiftsStats);
bot.hears('📊 /gifts', handleGiftsStats);

// 6. Command: /buy & /gift & '🎁 /buy'
const handleBuyOrGift = async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('🎁 Usage: `/buy <item_name> <recipient_username>`\n\nExample: `/buy Griddy Ninja`', { parse_mode: 'Markdown' });
  }

  const recipient = args.pop();
  const item = args.join(' ');

  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  ctx.reply(`⏳ Processing Gift for *${item}* to *${recipient}*...`, { parse_mode: 'Markdown' });

  const res = await GiftingService.giftItemToUser(accounts[0], recipient, item, 'Sent via Zerkshop Bot!');

  if (!res.success) {
    return ctx.reply(`❌ Gifting failed: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `🎉 *GIFT TRANSACTION COMPLETED!*\n\n` +
      `📦 Item: *${res.item}*\n` +
      `💰 Price: *${res.price} V-Bucks*\n` +
      `👤 Sender: *${res.sender}*\n` +
      `🎯 Recipient: *${res.recipient}*`
  );
};

bot.command('buy', handleBuyOrGift);
bot.command('gift', handleBuyOrGift);
bot.hears('🎁 /buy', (ctx) => {
  return ctx.reply('🎁 To Buy or Gift an item, send:\n`/buy <item_name> <recipient_username>`\n\nExample: `/buy Griddy Ninja`', { parse_mode: 'Markdown' });
});

// 7. Command: /friend & '👥 /friend'
const handleFriend = async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length) {
    return ctx.reply('👥 Usage: `/friend <target_epic_username>`\n\nExample: `/friend Ninja`', { parse_mode: 'Markdown' });
  }

  const targetUsername = args.join(' ');
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  ctx.reply(`⏳ Sending Epic Games friend request to *${targetUsername}*...`, { parse_mode: 'Markdown' });

  const res = await EpicAccountService.addFriend(accounts[0], targetUsername);
  if (!res.success) {
    return ctx.reply(`❌ Friend request failed: ${res.error}`);
  }

  return ctx.replyWithMarkdown(`✅ *Friend request sent to ${res.targetDisplayName}!*\n\n*Note: Epic Games requires 48 hours of friendship before gifting.*`);
};

bot.command('friend', handleFriend);
bot.hears('👥 /friend', (ctx) => {
  return ctx.reply('👥 To add a friend on Epic Games, send:\n`/friend <target_epic_username>`', { parse_mode: 'Markdown' });
});

// 8. Command: /remove & Account inline removal
bot.command('remove', async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('📂 No accounts to remove.');
  }

  const acc = accounts[0];
  EpicAccountService.removeAccount(acc.accountId);
  return ctx.replyWithMarkdown(`🗑️ *Account ${acc.displayName} removed successfully.*`);
});

bot.action(/acc_rm_(.+)/, async (ctx) => {
  const accountId = ctx.match[1];
  const res = EpicAccountService.removeAccount(accountId);
  if (res.success) {
    await ctx.answerCbQuery('Account removed.');
    return ctx.replyWithMarkdown(`🗑️ *Account removed. ${res.remaining} remaining accounts.*`);
  }
  return ctx.answerCbQuery('Account not found.');
});

// 9. Command: /shop & '🛒 /shop'
const handleShop = async (ctx) => {
  ctx.reply('⏳ Fetching current Fortnite Item Shop...');
  const res = await FortniteApiService.getShop();
  if (!res.success) {
    return ctx.reply(`❌ Error fetching shop: ${res.error}`);
  }

  tgShopCache = res.data;
  const { text, keyboard } = buildShopMessage(tgShopCache, 0);
  return ctx.replyWithMarkdown(text, keyboard);
};

bot.command('shop', handleShop);
bot.hears('🛒 /shop', handleShop);

bot.action(/tgshop_(prev|next)_(\d+)/, async (ctx) => {
  const action = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const newPage = action === 'next' ? page + 1 : page - 1;

  if (!tgShopCache) {
    const res = await FortniteApiService.getShop();
    if (!res.success) return ctx.answerCbQuery('Failed to refresh shop.');
    tgShopCache = res.data;
  }

  const { text, keyboard } = buildShopMessage(tgShopCache, newPage);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  return ctx.answerCbQuery();
});

// 10. Command: /settings & '⚙️ /settings'
const handleSettings = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  const activeName = accounts.length ? accounts[0].displayName : 'None';

  const text =
    `⚙️ *ZERKSHOP ACCOUNT SETTINGS*\n\n` +
    `👤 Active Gifting Account: *${activeName}*\n` +
    `📂 Total Accounts Linked: *${accounts.length}*\n` +
    `🌟 Support-A-Creator Code: Use \`/setsac <code>\`\n\n` +
    `*Commands Quick Reference:*\n` +
    `• \`/vbucks\` - Check V-Bucks balance\n` +
    `• \`/gifts\` - Check 24h gifting limit\n` +
    `• \`/friend <name>\` - Add friend on Epic\n` +
    `• \`/buy <item> <name>\` - Buy / Gift item`;

  return ctx.replyWithMarkdown(text);
};

bot.command('settings', handleSettings);
bot.hears('⚙️ /settings', handleSettings);

// Launch Bot
bot
  .launch()
  .then(() => console.log(`🚀 Telegram Bot is live and listening!`))
  .catch((err) => console.error('Error launching Telegram bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
