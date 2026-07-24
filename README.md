# 🎮 Fortnite Discord Bot - Complete Guide & Setup

A feature-rich, modern Fortnite Discord Bot built with **Node.js (discord.js v14)** and **Fortnite-API.com**.
Supports all 100% features of the Fortnite API with rich Discord UI (Embeds, Buttons, Thumbnails, Stat Cards).

---

## 🚀 Features Overview

| Command | Description |
| :--- | :--- |
| **`/shop`** | Displays current Fortnite Item Shop with prices, rarities, Jam Tracks, Bundles, and interactive Pagination buttons. |
| **`/stats <username> [platform]`** | Fetches lifetime & season stats (Wins, K/D ratio, Win Rate, Matches, BP Level) and generates stat card graphics. |
| **`/cosmetic <name>`** | Search any Skin, Pickaxe, Emote, or Backbling to see rarity, description, intro season, and high-res preview. |
| **`/map`** | View the current Battle Royale island map image with POIs. |
| **`/news`** | Latest Battle Royale news and announcement banners. |
| **`/aes`** | Current Fortnite patch build and AES encryption keys. |
| **`/creatorcode <code>`** | Verify Support-A-Creator code owner & active status. |
| **`/help`** | Interactive help menu listing all available commands. |

---

## 🛠️ Step-by-Step Setup Guide

### 1. Prerequisites
- [Node.js v18+](https://nodejs.org/) installed.
- A Discord account and a server where you have Administrator permissions.

### 2. Create your Discord Bot Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it (e.g. `Fortnite Master Bot`).
3. Under **Bot** tab:
   - Click **Reset Token** and copy your **Bot Token**.
   - Enable `MESSAGE CONTENT INTENT` if needed.
4. Under **OAuth2** tab:
   - Copy your **Client ID** (Application ID).
5. Generate Bot Invite URL:
   - Go to **OAuth2** -> **URL Generator**.
   - Select scopes: `bot` & `applications.commands`.
   - Select permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Use Slash Commands`.
   - Copy the URL, paste it in your browser, and select your Discord Server to invite the bot.

### 3. Environment Configuration (`.env`)
Open [.env](file:///C:/Users/Imad%20ADAOUMOUM/.gemini/antigravity-ide/scratch/fortnite-bot/.env) and fill in your keys:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_server_id_here   # (Optional: adding this makes commands load instantly for testing)
FORTNITE_API_KEY=######################
```

### 4. Deploy Commands & Launch
In your terminal, navigate to the bot directory:

```bash
# Register all 8 Slash Commands with Discord
npm run deploy

# Start the Bot
npm start
```

---

## 📂 Project Architecture

```
scratch/fortnite-bot/
├── .env                         # Discord Tokens & Fortnite API Key
├── .env.example                 # Environment template
├── package.json                 # Dependencies (discord.js, axios, dotenv)
└── src/
    ├── config.js                # Config loader
    ├── index.js                 # Main bot launcher & event listener
    ├── deploy-commands.js       # Deploy slash commands script
    ├── services/
    │   └── fortniteApi.js       # Wrapper for all Fortnite-API.com endpoints
    ├── embeds/
    │   ├── shopEmbed.js         # Shop embed & buttons generator
    │   ├── statsEmbed.js        # Stats embed & graphic generator
    │   └── newsEmbed.js         # News embed generator
    └── commands/
        ├── shop.js              # /shop command
        ├── stats.js             # /stats command
        ├── cosmetic.js          # /cosmetic command
        ├── map.js               # /map command
        ├── news.js              # /news command
        ├── aes.js               # /aes command
        ├── creatorcode.js       # /creatorcode command
        └── help.js              # /help command
```
