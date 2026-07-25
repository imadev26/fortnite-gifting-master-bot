const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const FortniteApiService = require('./services/fortniteApi');
const EpicAuthService = require('./services/epicAuthService');
const GiftingService = require('./services/giftingService');
const EpicAccountService = require('./services/epicAccountService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('⚠️ TELEGRAM_BOT_TOKEN is empty in .env!');
  module.exports = null;
  return;
}

const bot = new Telegraf(token);

// ─────────────────────────────────────────────
// SECURITY MIDDLEWARE — Whitelist Authorization
// ─────────────────────────────────────────────
const ALLOWED_IDS_RAW = process.env.ALLOWED_USER_IDS || '';
const ALLOWED_IDS = new Set(
  ALLOWED_IDS_RAW.split(',')
    .map((id) => id.trim())
    .filter((id) => id && id !== 'YOUR_TELEGRAM_ID_HERE')
    .map(Number)
);

if (ALLOWED_IDS.size === 0) {
  console.warn('⚠️ WARNING: ALLOWED_USER_IDS is not set in .env — bot is OPEN to everyone!');
  console.warn('   Add your Telegram ID to ALLOWED_USER_IDS in .env to secure the bot.');
}

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;

  if (ALLOWED_IDS.size === 0) return next();

  if (!userId || !ALLOWED_IDS.has(userId)) {
    const username = ctx.from?.username ? '@' + ctx.from.username : 'Unknown';
    console.warn(`🚫 Blocked unauthorized access — User: ${username} (ID: ${userId})`);
    try {
      await ctx.reply(
        '🚫 *Access Denied*\n\n' +
        'You are not authorized to use this bot.\n' +
        '_نتا ماشي able باش تخدم فهاد البوت_ 🔒',
        { parse_mode: 'Markdown' }
      );
    } catch (_) {}
    return;
  }

  return next();
});

// ─────────────────────────────────────────────
// SESSION STATE MACHINE
// ─────────────────────────────────────────────
const userSessions = new Map();

function getSession(userId) {
  if (!userSessions.has(userId)) userSessions.set(userId, {});
  return userSessions.get(userId);
}

function clearSession(userId) {
  userSessions.delete(userId);
}

// ─────────────────────────────────────────────
// SHOP CACHE (10-minute TTL)
// ─────────────────────────────────────────────
let tgShopCache = null;
let tgShopLastFetch = 0;
const TG_SHOP_CACHE_TTL = 10 * 60 * 1000;

async function getShopCached() {
  const now = Date.now();
  if (tgShopCache && now - tgShopLastFetch < TG_SHOP_CACHE_TTL) {
    return { success: true, data: tgShopCache };
  }
  const res = await FortniteApiService.getShop();
  if (res.success) {
    tgShopCache = res.data;
    tgShopLastFetch = now;
  }
  return res;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getItemDetails(entry) {
  let itemName = 'Special Offer';
  let rarity = '';
  if (entry.brItems && entry.brItems[0]) {
    itemName = entry.brItems[0].name || itemName;
    rarity = entry.brItems[0].rarity?.displayValue || entry.brItems[0].rarity?.value || '';
  } else if (entry.items && entry.items[0]) {
    itemName = entry.items[0].name || itemName;
    rarity = entry.items[0].rarity?.displayValue || entry.items[0].rarity?.value || '';
  } else if (entry.tracks && entry.tracks[0]) {
    itemName = `🎵 ${entry.tracks[0].title}`;
    rarity = 'Jam Track';
  } else if (entry.bundle) {
    itemName = `📦 ${entry.bundle.name}`;
    rarity = 'Bundle';
  }
  const price = entry.finalPrice || entry.regularPrice || 'N/A';
  return { itemName, rarity, price };
}

function buildAccountKeyboard(accounts, callbackPrefix) {
  return Markup.inlineKeyboard(
    accounts.map((acc, idx) => [
      Markup.button.callback(
        `${idx === 0 ? '⭐ ' : ''}💳 ${acc.displayName}`,
        `${callbackPrefix}_${acc.accountId}`
      ),
    ])
  );
}

function buildShopItemKeyboard(shopData, pageIndex = 0, itemsPerPage = 5) {
  const entries = shopData.entries || [];
  const totalPages = Math.ceil(entries.length / itemsPerPage);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = currentPage * itemsPerPage;
  const pageEntries = entries.slice(start, start + itemsPerPage);

  let text = `🛒 *FORTNITE ITEM SHOP* — Select an item to gift\n`;
  text += `📅 *${shopData.date ? shopData.date.split('T')[0] : 'Today'}* • ${entries.length} offers\n\n`;

  const itemButtons = [];

  pageEntries.forEach((entry, idx) => {
    const { itemName, rarity, price } = getItemDetails(entry);
    const label = `${itemName}${rarity ? ` (${rarity})` : ''} — ${price} V-Bucks`;
    const truncated = label.length > 60 ? label.substring(0, 57) + '...' : label;

    text += `*${start + idx + 1}.* ${itemName}${rarity ? ` _(${rarity})_` : ''}\n💰 *${price} V-Bucks*\n\n`;
    itemButtons.push([Markup.button.callback(truncated, `shopitem_${start + idx}`)]);
  });

  const navButtons = [];
  if (currentPage > 0) navButtons.push(Markup.button.callback('◀ Prev', `shoppage_prev_${currentPage}`));
  if (currentPage < totalPages - 1) navButtons.push(Markup.button.callback('Next ▶', `shoppage_next_${currentPage}`));
  if (navButtons.length) itemButtons.push(navButtons);
  itemButtons.push([Markup.button.callback('❌ Cancel', 'gift_cancel')]);

  text += `📄 Page *${currentPage + 1}* / *${totalPages}*`;
  return { text, keyboard: Markup.inlineKeyboard(itemButtons), currentPage, totalPages };
}

function buildShopBrowseMessage(shopData, pageIndex = 0, itemsPerPage = 5) {
  const entries = shopData.entries || [];
  const totalPages = Math.ceil(entries.length / itemsPerPage);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = currentPage * itemsPerPage;
  const pageEntries = entries.slice(start, start + itemsPerPage);

  let text = `🛒 *FORTNITE DAILY ITEM SHOP*\n`;
  text += `📅 Date: *${shopData.date ? shopData.date.split('T')[0] : 'Today'}* • Offers: *${entries.length}*\n\n`;

  pageEntries.forEach((entry, idx) => {
    const { itemName, rarity, price } = getItemDetails(entry);
    text += `*${start + idx + 1}. ${itemName}* _(${rarity || 'Cosmetic'})_\n💰 Price: *${price} V-Bucks*\n\n`;
  });

  text += `📄 Page *${currentPage + 1}* of *${totalPages}*`;

  const buttons = [];
  if (currentPage > 0) buttons.push(Markup.button.callback('◀ Previous', `tgshop_prev_${currentPage}`));
  if (currentPage < totalPages - 1) buttons.push(Markup.button.callback('Next ▶', `tgshop_next_${currentPage}`));

  const keyboard = buttons.length ? Markup.inlineKeyboard([buttons]) : null;
  return { text, keyboard };
}

// ─────────────────────────────────────────────
// 1. /start & /help
// ─────────────────────────────────────────────
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
    `🔄 */syncfriends* - Bulk transfer/sync friends between accounts\n` +
    `🗑️ */remove* - Remove a stored account\n` +
    `⚙️ */settings* - Account settings & SAC Code`;

  return ctx.replyWithMarkdown(
    welcomeText,
    Markup.keyboard([
      ['🛒 /shop', '💳 /vbucks'],
      ['🎁 /buy', '📊 /gifts'],
      ['🔑 /login', '📂 /accounts'],
      ['👥 /friend', '🔄 /syncfriends'],
      ['⚙️ /settings'],
    ]).resize()
  );
});

bot.help((ctx) => ctx.start());

// ─────────────────────────────────────────────
// 2. /login & /code
// ─────────────────────────────────────────────
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
bot.hears(/(🔑\s*)?\/login/i, handleLoginPrompt);

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
      `🌟 Support-A-Creator Code: \`xzerk\` *(Applied Automatically)*\n` +
      `📅 Added: \`${res.account.addedAt.split('T')[0]}\``
  );
});

// ─────────────────────────────────────────────
// 3. /accounts
// ─────────────────────────────────────────────
const handleAccounts = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('📂 No Epic Games accounts stored yet. Use /login to add an account!');
  }

  let text = `📂 *LINKED EPIC GAMES ACCOUNTS (${accounts.length})*\n\n`;
  const buttons = [];

  accounts.forEach((acc, idx) => {
    const activeTag = idx === 0 ? ' ⭐ *[ACTIVE]*' : '';
    text += `${idx + 1}. *${acc.displayName}*${activeTag}\n   ID: \`${acc.accountId}\`\n   Added: \`${acc.addedAt.split('T')[0]}\`\n\n`;
    buttons.push([
      Markup.button.callback(`💳 V-Bucks: ${acc.displayName}`, `acc_vbucks_${acc.accountId}`),
      Markup.button.callback(`🗑️ Remove`, `acc_rm_${acc.accountId}`),
    ]);
  });

  text += `_⭐ = Active gifting account (first in list)_`;

  return ctx.replyWithMarkdown(text, Markup.inlineKeyboard(buttons));
};

bot.command('accounts', handleAccounts);
bot.hears(/(📂\s*)?\/accounts/i, handleAccounts);

// ─────────────────────────────────────────────
// 4. /vbucks — Account selector flow
// ─────────────────────────────────────────────
const handleVBucks = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  if (accounts.length === 1) {
    return fetchAndShowVBucks(ctx, accounts[0]);
  }

  return ctx.replyWithMarkdown(
    `💳 *SELECT ACCOUNT TO CHECK V-BUCKS:*`,
    buildAccountKeyboard(accounts, 'vb')
  );
};

async function fetchAndShowVBucks(ctx, acc) {
  await ctx.reply(`⏳ Fetching V-Bucks for *${acc.displayName}*...`, { parse_mode: 'Markdown' });
  const res = await EpicAccountService.getVBucksBalance(acc);
  if (!res.success) {
    return ctx.reply(`❌ Error fetching V-Bucks: ${res.error}`);
  }
  return ctx.replyWithMarkdown(
    `💳 *V-BUCKS BALANCE*\n\n` +
      `👤 Account: *${res.displayName}*\n` +
      `💰 Balance: *${res.balance.toLocaleString()} V-Bucks*`
  );
}

bot.command('vbucks', handleVBucks);
bot.hears(/(💳\s*)?\/vbucks/i, handleVBucks);

bot.action(/^vb_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');
  await ctx.answerCbQuery('Fetching V-Bucks...');
  await ctx.editMessageReplyMarkup(undefined);
  return fetchAndShowVBucks(ctx, acc);
});

bot.action(/^acc_vbucks_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');
  await ctx.answerCbQuery('Querying V-Bucks...');
  const res = await EpicAccountService.getVBucksBalance(acc);
  if (!res.success) return ctx.reply(`❌ Error: ${res.error}`);
  return ctx.replyWithMarkdown(`💳 *${acc.displayName}* — *${res.balance.toLocaleString()} V-Bucks*`);
});

// ─────────────────────────────────────────────
// 5. /gifts — Account selector flow
// ─────────────────────────────────────────────
const handleGiftsStats = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  if (accounts.length === 1) {
    return fetchAndShowGifts(ctx, accounts[0]);
  }

  return ctx.replyWithMarkdown(
    `📊 *SELECT ACCOUNT TO CHECK GIFTING STATS:*`,
    buildAccountKeyboard(accounts, 'gf')
  );
};

async function fetchAndShowGifts(ctx, acc) {
  await ctx.reply(`⏳ Checking 24h gifting stats for *${acc.displayName}*...`, { parse_mode: 'Markdown' });
  const res = await EpicAccountService.getGiftingStats(acc);
  if (!res.success) {
    return ctx.reply(`❌ Error: ${res.error}`);
  }

  const bar = '🟩'.repeat(res.sent) + '⬜'.repeat(Math.max(0, res.max - res.sent));

  return ctx.replyWithMarkdown(
    `📊 *24-HOUR GIFTING STATUS*\n\n` +
      `👤 Account: *${res.displayName}*\n` +
      `🎁 Gifts Sent: *${res.sent} / ${res.max}*\n` +
      bar + '\n' +
      `⚡ Remaining: *${res.remaining} gifts available*\n\n` +
      `_Fortnite allows max 5 gifts per 24 hours per account._`
  );
}

bot.command('gifts', handleGiftsStats);
bot.hears(/(📊\s*)?\/gifts/i, handleGiftsStats);

bot.action(/^gf_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');
  await ctx.answerCbQuery('Checking gift stats...');
  await ctx.editMessageReplyMarkup(undefined);
  return fetchAndShowGifts(ctx, acc);
});

// ─────────────────────────────────────────────
// 6. /remove — Account picker + confirmation
// ─────────────────────────────────────────────
bot.command('remove', async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('📂 No accounts to remove.');
  }

  const buttons = accounts.map((acc, idx) => [
    Markup.button.callback(
      `${idx === 0 ? '⭐ ' : ''}🗑️ ${acc.displayName}`,
      `rm_select_${acc.accountId}`
    ),
  ]);
  buttons.push([Markup.button.callback('❌ Cancel', 'rm_cancel')]);

  return ctx.replyWithMarkdown(
    `🗑️ *REMOVE AN ACCOUNT*\n\nSelect which account you want to remove:`,
    Markup.inlineKeyboard(buttons)
  );
});

bot.action(/^rm_select_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `⚠️ *Are you sure you want to remove this account?*\n\n👤 *${acc.displayName}*\n🆔 \`${acc.accountId}\`\n\n_This action cannot be undone._`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Yes, Remove', `rm_confirm_${acc.accountId}`),
          Markup.button.callback('❌ Cancel', 'rm_cancel'),
        ],
      ]),
    }
  );
});

bot.action(/^rm_confirm_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const res = EpicAccountService.removeAccount(accountId);
  if (res.success) {
    await ctx.answerCbQuery('Account removed!');
    return ctx.editMessageText(
      `✅ *Account removed successfully.*\n📂 ${res.remaining} account(s) remaining.`,
      { parse_mode: 'Markdown' }
    );
  }
  return ctx.answerCbQuery('Account not found.');
});

bot.action(/^acc_rm_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');

  await ctx.answerCbQuery();
  return ctx.replyWithMarkdown(
    `⚠️ *Remove account?*\n\n👤 *${acc.displayName}*`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, Remove', `rm_confirm_${acc.accountId}`),
        Markup.button.callback('❌ Cancel', 'rm_cancel'),
      ],
    ])
  );
});

bot.action('rm_cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled.');
  return ctx.editMessageText('❌ Removal cancelled.');
});

// ─────────────────────────────────────────────
// 7. /shop — Browse (read-only, cached)
// ─────────────────────────────────────────────
const handleShop = async (ctx) => {
  await ctx.reply('⏳ Fetching current Fortnite Item Shop...');
  const res = await getShopCached();
  if (!res.success) {
    return ctx.reply(`❌ Error fetching shop: ${res.error}`);
  }
  const { text, keyboard } = buildShopBrowseMessage(res.data, 0);
  return ctx.replyWithMarkdown(text, keyboard);
};

bot.command('shop', handleShop);
bot.hears(/(🛒\s*)?\/shop/i, handleShop);

bot.action(/^tgshop_(prev|next)_(\d+)$/, async (ctx) => {
  const action = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const newPage = action === 'next' ? page + 1 : page - 1;

  const res = await getShopCached();
  if (!res.success) return ctx.answerCbQuery('Failed to refresh shop.');

  const { text, keyboard } = buildShopBrowseMessage(res.data, newPage);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  return ctx.answerCbQuery();
});

// ─────────────────────────────────────────────
// 8. /buy — Guided gift flow
// ─────────────────────────────────────────────
const handleBuyOrGift = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  clearSession(ctx.from.id);

  if (accounts.length === 1) {
    const session = getSession(ctx.from.id);
    session.selectedAccount = accounts[0];
    session.step = 'select_item';
    return startItemSelection(ctx);
  }

  return ctx.replyWithMarkdown(
    `🎁 *GIFT AN ITEM*\n\nStep 1/4 — Select the account to send from:`,
    buildAccountKeyboard(accounts, 'buyacc')
  );
};

async function startItemSelection(ctx) {
  const res = await getShopCached();
  if (!res.success) {
    clearSession(ctx.from.id);
    return ctx.reply(`❌ Could not load the shop: ${res.error}`);
  }

  const session = getSession(ctx.from.id);
  session.shopData = res.data;
  session.shopPage = 0;
  session.step = 'select_item';

  const { text, keyboard } = buildShopItemKeyboard(res.data, 0);
  return ctx.replyWithMarkdown(
    `🎁 *GIFT AN ITEM* — Sender: *${session.selectedAccount.displayName}*\n\nStep 2/4 — Pick an item to gift:`,
    keyboard
  );
}

bot.action(/^buyacc_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const acc = accounts.find((a) => a.accountId === accountId);
  if (!acc) return ctx.answerCbQuery('Account not found.');

  const session = getSession(ctx.from.id);
  session.selectedAccount = acc;
  session.step = 'select_item';

  await ctx.answerCbQuery(`Selected: ${acc.displayName}`);
  await ctx.editMessageReplyMarkup(undefined);

  return startItemSelection(ctx);
});

bot.action(/^shoppage_(prev|next)_(\d+)$/, async (ctx) => {
  const action = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const newPage = action === 'next' ? page + 1 : page - 1;

  const session = getSession(ctx.from.id);
  if (!session || !session.shopData) return ctx.answerCbQuery('Session expired. Use /buy to restart.');

  session.shopPage = newPage;
  const { text, keyboard } = buildShopItemKeyboard(session.shopData, newPage);

  await ctx.editMessageText(
    `🎁 *GIFT AN ITEM* — Sender: *${session.selectedAccount ? session.selectedAccount.displayName : '?'}*\n\nStep 2/4 — Pick an item to gift:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
  return ctx.answerCbQuery();
});

bot.action(/^shopitem_(\d+)$/, async (ctx) => {
  const idx = parseInt(ctx.match[1], 10);
  const session = getSession(ctx.from.id);

  if (!session || !session.shopData) {
    await ctx.answerCbQuery('Session expired. Use /buy to restart.');
    return ctx.editMessageText('❌ Session expired. Use /buy to start again.');
  }

  const entry = session.shopData.entries[idx];
  if (!entry) return ctx.answerCbQuery('Item not found. Try again.');

  const { itemName, rarity, price } = getItemDetails(entry);
  const numericPrice = typeof price === 'number' ? price : parseInt(price, 10) || 0;

  session.selectedItem = { entry, itemName, rarity, price, idx };

  await ctx.answerCbQuery(`Selected: ${itemName}`);

  // Instant V-Bucks balance check
  const vbCheck = await EpicAccountService.getVBucksBalance(session.selectedAccount);
  if (vbCheck.success && numericPrice > 0 && vbCheck.balance < numericPrice) {
    return ctx.editMessageText(
      `❌ *Solde V-Bucks غير كافي (Insufficient V-Bucks)*\n\n` +
        `👤 Account: *${session.selectedAccount.displayName}*\n` +
        `📦 Item: *${itemName}*\n` +
        `💰 Item Price: *${numericPrice.toLocaleString()} V-Bucks*\n` +
        `💳 Your Balance: *${vbCheck.balance.toLocaleString()} V-Bucks*\n\n` +
        `⚠️ *المبلغ اللي عندك فـ الحساب ما كافيش باش تصيفط هاد الـ Gift.*`,
      { parse_mode: 'Markdown' }
    );
  }

  session.step = 'select_friend';
  await ctx.editMessageText('⏳ Loading your Epic friends list...', { parse_mode: 'Markdown' });

  const friendsRes = await EpicAccountService.getFriendsList(session.selectedAccount);

  if (!friendsRes.success || !friendsRes.friends.length) {
    session.step = 'enter_recipient';
    return ctx.editMessageText(
      `🎁 *GIFT AN ITEM*\n\n` +
      `✅ Selected: *${itemName}*${rarity ? ` _(${rarity})_` : ''}\n` +
      `💰 Price: *${price} V-Bucks*\n\n` +
      `Step 3/4 — Type the *Epic Games username* of the recipient:`,
      { parse_mode: 'Markdown' }
    );
  }

  session.friendsList = friendsRes.friends;
  session.friendsPage = 0;

  const { text: fText, keyboard: fKeyboard } = buildFriendKeyboard(friendsRes.friends, 0, itemName, price, rarity);
  return ctx.editMessageText(fText, { parse_mode: 'Markdown', ...fKeyboard });
});

function buildFriendKeyboard(friends, pageIndex, itemName, price, rarity) {
  const friendsPerPage = 8;
  const totalPages = Math.ceil(friends.length / friendsPerPage);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = currentPage * friendsPerPage;
  const pageFriends = friends.slice(start, start + friendsPerPage);

  let text = `🎁 *GIFT AN ITEM*\n\n`;
  text += `✅ Item: *${itemName}*${rarity ? ` _(${rarity})_` : ''}\n`;
  text += `💰 Price: *${price} V-Bucks*\n\n`;
  text += `Step 3/4 — *Select recipient from your Epic friends:*\n`;
  text += `👥 ${friends.length} friends (Alphabetical) • Page ${currentPage + 1}/${totalPages}`;

  const rows = pageFriends.map((f, i) => [
    Markup.button.callback(`${f.icon || '👤'} ${f.displayName} (${f.platform || 'Epic'})`, `friend_select_${start + i}`)
  ]);

  const navButtons = [];
  if (currentPage > 0) navButtons.push(Markup.button.callback('◀ Prev', `friendpage_prev_${currentPage}`));
  if (currentPage < totalPages - 1) navButtons.push(Markup.button.callback('Next ▶', `friendpage_next_${currentPage}`));
  if (navButtons.length) rows.push(navButtons);
  rows.push([Markup.button.callback('✏️ Type username manually', 'friend_manual')]);
  rows.push([Markup.button.callback('❌ Cancel', 'gift_cancel')]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

bot.action(/^friend_select_(\d+)$/, async (ctx) => {
  const idx = parseInt(ctx.match[1], 10);
  const session = getSession(ctx.from.id);

  if (!session || !session.friendsList || !session.friendsList[idx]) {
    await ctx.answerCbQuery('Session expired.');
    return ctx.editMessageText('❌ Session expired. Use /buy to start again.');
  }

  const friend = session.friendsList[idx];
  session.recipientUsername = friend.displayName;
  session.step = 'confirm_gift';

  const { selectedAccount, selectedItem } = session;
  await ctx.answerCbQuery(`Selected: ${friend.displayName}`);

  return ctx.editMessageText(
    `🎁 *CONFIRM GIFT*\n\n` +
      `📦 Item: *${selectedItem.itemName}*${selectedItem.rarity ? ` _(${selectedItem.rarity})_` : ''}\n` +
      `💰 Price: *${selectedItem.price} V-Bucks*\n` +
      `👤 From: *${selectedAccount.displayName}*\n` +
      `🎯 To: *${friend.displayName}* ${friend.icon || ''} _(${friend.platform || 'Epic'})_\n\n` +
      `_Make sure you have been friends for at least 48 hours!_`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Confirm & Send Gift', 'gift_confirm'),
          Markup.button.callback('❌ Cancel', 'gift_cancel'),
        ],
      ]),
    }
  );
});

bot.action(/^friendpage_(prev|next)_(\d+)$/, async (ctx) => {
  const action = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  const newPage = action === 'next' ? page + 1 : page - 1;

  const session = getSession(ctx.from.id);
  if (!session || !session.friendsList || !session.selectedItem) {
    return ctx.answerCbQuery('Session expired. Use /buy to restart.');
  }

  session.friendsPage = newPage;
  const { selectedItem } = session;
  const { text, keyboard } = buildFriendKeyboard(session.friendsList, newPage, selectedItem.itemName, selectedItem.price, selectedItem.rarity);

  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  return ctx.answerCbQuery();
});

bot.action('friend_manual', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || !session.selectedItem) return ctx.answerCbQuery('Session expired.');
  session.step = 'enter_recipient';
  await ctx.answerCbQuery();
  const { selectedItem } = session;
  return ctx.editMessageText(
    `🎁 *GIFT AN ITEM*\n\n✅ Selected: *${selectedItem.itemName}*\n💰 Price: *${selectedItem.price} V-Bucks*\n\nType the *Epic Games username* of the recipient:`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('gift_cancel', async (ctx) => {
  clearSession(ctx.from.id);
  await ctx.answerCbQuery('Cancelled.');
  return ctx.editMessageText('❌ Gift cancelled.');
});

bot.on('text', async (ctx, next) => {
  const session = getSession(ctx.from.id);
  const text = ctx.message.text || '';

  // Pass through if text contains '/' or user is not in an active text step
  if (text.includes('/') || !session || !session.step) return next();

  if (session.step === 'enter_recipient') {
    const recipientUsername = text.trim();
    session.recipientUsername = recipientUsername;
    session.step = 'confirm_gift';

    const { selectedAccount, selectedItem } = session;

    return ctx.replyWithMarkdown(
      `🎁 *CONFIRM GIFT*\n\n` +
        `📦 Item: *${selectedItem.itemName}*${selectedItem.rarity ? ` _(${selectedItem.rarity})_` : ''}\n` +
        `💰 Price: *${selectedItem.price} V-Bucks*\n` +
        `👤 From: *${selectedAccount.displayName}*\n` +
        `🎯 To: *${recipientUsername}*\n\n` +
        `_Make sure you have been friends for at least 48 hours!_`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Confirm & Send Gift', 'gift_confirm'),
          Markup.button.callback('❌ Cancel', 'gift_cancel'),
        ],
      ])
    );
  }

  if (session.step === 'enter_sac') {
    const code = text.trim();
    clearSession(ctx.from.id);
    return processSAC(ctx, code);
  }

  return next();
});

bot.action('gift_confirm', async (ctx) => {
  const session = getSession(ctx.from.id);

  if (!session || !session.selectedAccount || !session.selectedItem || !session.recipientUsername) {
    await ctx.answerCbQuery('Session expired.');
    return ctx.editMessageText('❌ Session expired. Use /buy to start again.');
  }

  await ctx.answerCbQuery('Sending gift...');
  await ctx.editMessageText('⏳ Processing your gift... Please wait.');

  const { selectedAccount, selectedItem, recipientUsername } = session;
  clearSession(ctx.from.id);

  const res = await GiftingService.giftItemToUser(
    selectedAccount,
    recipientUsername,
    selectedItem.entry?.offerId || selectedItem.itemName,
    'Sent via Zerkshop Bot! 🎁'
  );

  if (!res.success) {
    return ctx.reply(`❌ Gifting failed: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `🎉 *GIFT SENT SUCCESSFULLY!*\n\n` +
      `📦 Item: *${res.item}*\n` +
      `💰 Price: *${res.price} V-Bucks*\n` +
      `👤 From: *${res.sender}*\n` +
      `🎯 To: *${res.recipient}*`
  );
});

bot.command('buy', handleBuyOrGift);
bot.command('gift', handleBuyOrGift);
bot.hears(/(🎁\s*)?\/buy/i, handleBuyOrGift);
bot.hears(/(🎁\s*)?\/gift/i, handleBuyOrGift);

// ─────────────────────────────────────────────
// 9. /friend
// ─────────────────────────────────────────────
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

  await ctx.reply(`⏳ Sending Epic Games friend request to *${targetUsername}*...`, { parse_mode: 'Markdown' });

  const res = await EpicAccountService.addFriend(accounts[0], targetUsername);
  if (!res.success) {
    return ctx.reply(`❌ Friend request failed: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `✅ *Friend request sent to ${res.targetDisplayName}!*\n\n_Note: Epic Games requires 48 hours of friendship before gifting._`
  );
};

bot.command('friend', handleFriend);
bot.hears(/(👥\s*)?\/friend/i, (ctx) => {
  return ctx.reply('👥 To add a friend on Epic Games, send:\n`/friend <target_epic_username>`', { parse_mode: 'Markdown' });
});

// ─────────────────────────────────────────────
// 10. /settings + /setsac
// ─────────────────────────────────────────────
const handleSettings = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  const activeName = accounts.length ? accounts[0].displayName : 'None';

  const text =
    `⚙️ *ZERKSHOP ACCOUNT SETTINGS*\n\n` +
    `👤 Active Gifting Account: *${activeName}*\n` +
    `📂 Total Accounts Linked: *${accounts.length}*\n` +
    `🌟 Support-A-Creator Code: \`xzerk\` *(Fixed Default)*\n\n` +
    `*Commands Quick Reference:*\n` +
    `• \`/vbucks\` - Check V-Bucks balance\n` +
    `• \`/gifts\` - Check 24h gifting limit\n` +
    `• \`/friend <name>\` - Add friend on Epic\n` +
    `• \`/buy\` - Gift item (guided flow)\n` +
    `• \`/setsac <code>\` - Change Support-A-Creator code`;

  return ctx.replyWithMarkdown(
    text,
    Markup.inlineKeyboard([[Markup.button.callback('🌟 Set SAC Code', 'open_setsac')]])
  );
};

bot.command('settings', handleSettings);
bot.hears(/(⚙️\s*)?\/settings/i, handleSettings);

bot.action('open_setsac', async (ctx) => {
  await ctx.answerCbQuery();
  const session = getSession(ctx.from.id);
  session.step = 'enter_sac';
  return ctx.reply('🌟 Type your *Support-A-Creator code* below:', { parse_mode: 'Markdown' });
});

bot.command('setsac', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (!args.length) {
    const session = getSession(ctx.from.id);
    session.step = 'enter_sac';
    return ctx.reply('🌟 Type your *Support-A-Creator code* below:', { parse_mode: 'Markdown' });
  }
  return processSAC(ctx, args[0]);
});

async function processSAC(ctx, code) {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  await ctx.reply(`⏳ Validating SAC code *${code}*...`, { parse_mode: 'Markdown' });

  const checkRes = await FortniteApiService.getCreatorCode(code);
  if (!checkRes.success) {
    return ctx.replyWithMarkdown(
      `❌ *Invalid SAC code:* \`${code}\`\n\nMake sure the code is active and correctly spelled.`
    );
  }

  const res = await GiftingService.setAffiliateName(accounts[0], code);
  if (!res.success) {
    return ctx.reply(`❌ Failed to apply SAC code: ${res.error}`);
  }

  return ctx.replyWithMarkdown(
    `✅ *Support-A-Creator code set!*\n\n` +
      `🌟 Code: \`${res.code}\`\n` +
      `👤 Account: *${res.account}*\n\n` +
      `_Your purchases now support the creator._`
  );
}

// ─────────────────────────────────────────────
// LAUNCH
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 11. /syncfriends (Bulk Friend Sync / Transfer)
// ─────────────────────────────────────────────
const handleSyncFriends = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (accounts.length < 2) {
    return ctx.reply('⚠️ You need at least 2 linked Epic accounts to transfer/sync friends. Use /login to add another account.');
  }

  clearSession(ctx.from.id);
  const session = getSession(ctx.from.id);
  session.step = 'sync_source';

  const buttons = accounts.map((acc) => [
    Markup.button.callback(`📋 Source: ${acc.displayName}`, `syncsrc_${acc.accountId}`)
  ]);
  buttons.push([Markup.button.callback('❌ Cancel', 'gift_cancel')]);

  return ctx.replyWithMarkdown(
    `🔄 *BULK FRIEND SYNC / TRANSFER*\n\n` +
    `Transfer all accepted friends from one Epic account to another!\n\n` +
    `Step 1/2 — *Select SOURCE account* (whose friends you want to copy):`,
    Markup.inlineKeyboard(buttons)
  );
};

bot.command('syncfriends', handleSyncFriends);
bot.command('transfer', handleSyncFriends);
bot.command('sync', handleSyncFriends);
bot.hears(/(🔄\s*)?\/(syncfriends|transfer|sync)/i, handleSyncFriends);

bot.action(/^syncsrc_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const sourceAcc = accounts.find((a) => a.accountId === accountId);
  if (!sourceAcc) return ctx.answerCbQuery('Source account not found.');

  const session = getSession(ctx.from.id);
  session.syncSource = sourceAcc;
  session.step = 'sync_target';

  await ctx.answerCbQuery(`Source: ${sourceAcc.displayName}`);

  const targetAccounts = accounts.filter((a) => a.accountId !== accountId);
  const buttons = targetAccounts.map((acc) => [
    Markup.button.callback(`🎯 Target: ${acc.displayName}`, `synctgt_${acc.accountId}`)
  ]);
  buttons.push([Markup.button.callback('❌ Cancel', 'gift_cancel')]);

  return ctx.editMessageText(
    `🔄 *BULK FRIEND SYNC*\n\n` +
    `📋 Source: *${sourceAcc.displayName}*\n\n` +
    `Step 2/2 — *Select TARGET account* (which will send friend requests):`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
});

bot.action(/^synctgt_(.+)$/, async (ctx) => {
  const accountId = ctx.match[1];
  const accounts = EpicAuthService.getAccounts();
  const targetAcc = accounts.find((a) => a.accountId === accountId);
  const session = getSession(ctx.from.id);

  if (!session || !session.syncSource) {
    await ctx.answerCbQuery('Session expired.');
    return ctx.editMessageText('❌ Session expired. Use /syncfriends to start again.');
  }

  session.syncTarget = targetAcc;
  session.step = 'sync_confirm';

  const { syncSource } = session;
  await ctx.answerCbQuery(`Target: ${targetAcc.displayName}`);

  return ctx.editMessageText(
    `🔄 *CONFIRM BULK FRIEND SYNC*\n\n` +
    `📋 Source: *${syncSource.displayName}*\n` +
    `🎯 Target: *${targetAcc.displayName}*\n\n` +
    `⚠️ *${targetAcc.displayName}* will send Epic Games friend requests to all friends of *${syncSource.displayName}*.\n\n` +
    `_This process may take a minute depending on the number of friends._`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Start Syncing Friends', 'sync_confirm_start'),
          Markup.button.callback('❌ Cancel', 'gift_cancel')
        ]
      ])
    }
  );
});

bot.action('sync_confirm_start', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (!session || !session.syncSource || !session.syncTarget) {
    await ctx.answerCbQuery('Session expired.');
    return ctx.editMessageText('❌ Session expired. Use /syncfriends to start again.');
  }

  const { syncSource, syncTarget } = session;
  clearSession(ctx.from.id);

  await ctx.answerCbQuery('Starting bulk sync...');
  await ctx.editMessageText(`⏳ Initializing bulk friend sync from *${syncSource.displayName}* to *${syncTarget.displayName}*...`, { parse_mode: 'Markdown' });

  let lastUpdateMsg = 0;

  const result = await EpicAccountService.syncFriendsList(
    syncSource,
    syncTarget,
    async (current, total, friendName, sentCount, failCount) => {
      const now = Date.now();
      if (now - lastUpdateMsg > 2000 || current === total) {
        lastUpdateMsg = now;
        const percent = Math.floor((current / total) * 10);
        const bar = '🟩'.repeat(percent) + '⬜'.repeat(10 - percent);
        try {
          await ctx.editMessageText(
            `⏳ *SYNCING FRIENDS IN PROGRESS...*\n\n` +
            `📋 Source: *${syncSource.displayName}*\n` +
            `🎯 Target: *${syncTarget.displayName}*\n\n` +
            `👤 Processing: *${friendName}* (${current}/${total})\n` +
            `${bar}\n\n` +
            `✅ Sent: *${sentCount}* | ⚠️ Skipped: *${failCount}*`,
            { parse_mode: 'Markdown' }
          );
        } catch (_) {}
      }
    }
  );

  if (!result.success) {
    return ctx.reply(`❌ Friend sync failed: ${result.error}`);
  }

  return ctx.replyWithMarkdown(
    `🎉 *BULK FRIEND SYNC COMPLETE!*\n\n` +
    `📋 Source: *${result.source}*\n` +
    `🎯 Target: *${result.target}*\n\n` +
    `📊 *Results Summary:*\n` +
    `• Total Friends Processed: *${result.total}*\n` +
    `• ✅ Friend Requests Sent: *${result.sentCount}*\n` +
    `• ⚠️ Already Friends / Skipped: *${result.failCount}*\n\n` +
    `_Note: Epic Games requires 48 hours after friend request acceptance before gifting._`
  );
});


// ─────────────────────────────────────────────
// 12. /accept (Auto-Accept Pending Friend Requests)
// ─────────────────────────────────────────────
const handleAcceptPending = async (ctx) => {
  const accounts = EpicAuthService.getAccounts();
  if (!accounts.length) {
    return ctx.reply('❌ No linked Epic Games account found! Use /login first.');
  }

  await ctx.reply('⏳ Checking & accepting pending friend requests across all accounts...');

  let totalAccepted = 0;
  const reports = [];

  for (const acc of accounts) {
    const res = await EpicAccountService.acceptPendingFriends(acc);
    if (res.success) {
      if (res.acceptedCount > 0) {
        totalAccepted += res.acceptedCount;
        reports.push(`👤 *${res.accountName}*: Accepted *${res.acceptedCount}* friend(s) (${res.acceptedNames.join(', ')})`);
      } else {
        reports.push(`👤 *${res.accountName}*: No pending friend requests.`);
      }
    } else {
      reports.push(`👤 *${res.accountName}*: ❌ ${res.error}`);
    }
  }

  if (totalAccepted > 0) {
    return ctx.replyWithMarkdown(
      `🎉 *ACCEPTED ${totalAccepted} NEW FRIEND REQUEST(S)!*\n\n` +
      reports.join('\n\n') + '\n\n' +
      `_Note: Epic Games requires 48 hours after friend request acceptance before gifting._`
    );
  }

  return ctx.replyWithMarkdown(
    `🤝 *AUTO-ACCEPT FRIEND REQUESTS*\n\n` +
    reports.join('\n\n') + '\n\n' +
    `_No new pending friend requests found right now._`
  );
};

bot.command('accept', handleAcceptPending);
bot.command('acceptfriends', handleAcceptPending);
bot.hears(/(🤝\s*)?\/(accept|acceptfriends)/i, handleAcceptPending);



bot
  .launch()
  .then(() => console.log('🚀 Telegram Bot is live and listening!'))
  .catch((err) => console.error('Error launching Telegram bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
