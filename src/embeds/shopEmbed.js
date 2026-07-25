const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const RARITY_COLORS = {
  legendary: 0xea8427,
  epic: 0xb146e2,
  rare: 0x319bf5,
  uncommon: 0x60b031,
  common: 0xbebebe,
  icon: 0x1db9b6,
  marvel: 0xed1d24,
  dc: 0x0058b8,
  starwars: 0xebc815,
  gaminglegends: 0x5d00f5,
};

function getRarityColor(rarityValue) {
  const key = (rarityValue || '').toLowerCase();
  return RARITY_COLORS[key] || 0x00d2ff;
}

/**
 * Creates embeds for Fortnite Item Shop entries (/v2/shop schema)
 */
function createShopPageEmbed(shopData, pageIndex = 0, itemsPerPage = 5) {
  const entries = shopData.entries || [];

  if (!entries.length) {
    return {
      embeds: [
        new EmbedBuilder()
          .setTitle('ðŸ›’ Fortnite Item Shop')
          .setDescription('No shop entries available right now.')
          .setColor(0xff0000)
          .setTimestamp(),
      ],
      components: [],
    };
  }

  const totalPages = Math.ceil(entries.length / itemsPerPage);
  const currentPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = currentPage * itemsPerPage;
  const pageEntries = entries.slice(start, start + itemsPerPage);

  const shopDate = shopData.date ? shopData.date.split('T')[0] : 'Today';

  const embed = new EmbedBuilder()
    .setTitle('ðŸ›’ Fortnite Item Shop')
    .setDescription(`Currently **${entries.length}** offers in shop â€¢ Date: **${shopDate}**`)
    .setColor(0x00d2ff)
    .setFooter({ text: `Page ${currentPage + 1} of ${totalPages} â€¢ Fortnite-API.com` })
    .setTimestamp();

  pageEntries.forEach((entry, idx) => {
    let itemName = 'Special Offer';
    let itemRarity = 'Cosmetic';
    let itemDesc = '';
    let iconUrl = null;

    if (entry.brItems && entry.brItems.length > 0) {
      const mainItem = entry.brItems[0];
      itemName = mainItem.name || itemName;
      itemRarity = mainItem.rarity?.displayValue || mainItem.rarity?.value || itemRarity;
      itemDesc = mainItem.description ? `*${mainItem.description}*\n` : '';
      iconUrl = mainItem.images?.featured || mainItem.images?.icon || mainItem.images?.smallIcon;
    } else if (entry.tracks && entry.tracks.length > 0) {
      const track = entry.tracks[0];
      itemName = `ðŸŽµ ${track.title || 'Jam Track'} (${track.artist || ''})`;
      itemRarity = 'Jam Track';
      iconUrl = track.albumArt;
    } else if (entry.bundle) {
      itemName = `ðŸ“¦ ${entry.bundle.name}`;
      itemRarity = 'Bundle';
      iconUrl = entry.bundle.image;
    }

    const price = entry.finalPrice || entry.regularPrice || 'N/A';
    const originalPrice = entry.regularPrice && entry.regularPrice > entry.finalPrice ? `~~${entry.regularPrice}~~ ` : '';
    const section = entry.layout?.name ? ` [${entry.layout.name}]` : '';

    embed.addFields({
      name: `${start + idx + 1}. ${itemName} (${itemRarity})${section}`,
      value: `${itemDesc}ðŸ’° Price: ${originalPrice}**${price} V-Bucks**`,
      inline: false,
    });

    if (idx === 0 && iconUrl) {
      embed.setThumbnail(iconUrl);
    }
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_prev_${currentPage}`)
      .setLabel('â—€ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`shop_next_${currentPage}`)
      .setLabel('Next â–¶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  return { embeds: [embed], components: [row], totalPages };
}

module.exports = {
  createShopPageEmbed,
  getRarityColor,
};

