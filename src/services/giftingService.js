const axios = require('axios');
const EpicAuthService = require('./epicAuthService');
const FortniteApiService = require('./fortniteApi');

class GiftingService {
  /**
   * Resolve an Epic Games Username to an accountId
   */
  static async resolveDisplayName(username, accessToken) {
    try {
      const response = await axios.get(
        `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${encodeURIComponent(username)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.data && response.data.id) {
        return { success: true, accountId: response.data.id, displayName: response.data.displayName };
      }
      return { success: false, error: 'User not found on Epic Games' };
    } catch (error) {
      console.error('Error resolving username:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.errorMessage || 'Epic Games account not found' };
    }
  }

  /**
   * Set Support-A-Creator Code (Affiliate Name) for an Epic Games account
   */
  static async setAffiliateName(senderAccount, affiliateCode) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(senderAccount);
      if (!loginRes.success) {
        return { success: false, error: `Login failed: ${loginRes.error}` };
      }

      const { accessToken, accountId } = loginRes;

      const response = await axios.post(
        `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/SetAffiliateName?rvn=-1`,
        { affiliateName: affiliateCode },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.profileChanges) {
        return { success: true, code: affiliateCode, account: senderAccount.displayName };
      }
      return { success: false, error: 'Could not set Support-A-Creator code' };
    } catch (error) {
      console.error('Error setting affiliate code:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Support-A-Creator code invalid or inactive',
      };
    }
  }

  /**
   * Check Gifting Eligibility between Sender and Recipient for an Offer
   */
  static async checkEligibility(accessToken, senderAccountId, receiverAccountId, offerId) {
    try {
      const response = await axios.get(
        `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/gift/check_eligibility/recipient/${receiverAccountId}/offer/${encodeURIComponent(offerId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Gifting eligibility check failed (48h friendship or 2FA required)',
      };
    }
  }

  /**
   * Execute GiftCatalogEntry command on Fortnite Game MCP Profile Backend
   */
  static async giftCatalogEntry({ accessToken, senderAccountId, receiverAccountId, offerId, expectedTotalPrice, personalMessage = 'Enjoy your gift!' }) {
    try {
      const payload = {
        offerId,
        purchaseQuantity: 1,
        currency: 'MtxCurrency',
        currencySubGame: 'Client',
        expectedTotalPrice: parseInt(expectedTotalPrice, 10),
        gameContext: '',
        receiverAccountIds: [receiverAccountId],
        giftWrapTemplateId: 'GiftBox:GB_Default',
        personalMessage,
      };

      const response = await axios.post(
        `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${senderAccountId}/client/GiftCatalogEntry?rvn=-1`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.profileChanges) {
        return { success: true, data: response.data };
      }
      return { success: false, error: 'Gifting transaction completed with unexpected response structure.' };
    } catch (error) {
      console.error('Error sending GiftCatalogEntry:', error.response?.data || error.message);
      const msg = error.response?.data?.errorMessage || error.response?.data?.error || error.message;
      return {
        success: false,
        error: msg.includes('errors.com.epicgames.fortnite.id_invalid')
          ? 'Must be friends with recipient for at least 48 hours to send gifts!'
          : msg,
      };
    }
  }

  /**
   * Complete Gifting Flow for a specific Epic Account -> Recipient Username
   */
  static async giftItemToUser(senderAccount, recipientUsername, itemQuery, message = 'Sent via Fortnite Bot!') {
    // 1. Log in sender account
    const loginRes = await EpicAuthService.loginWithDeviceAuth(senderAccount);
    if (!loginRes.success) {
      return { success: false, error: `Login failed for ${senderAccount.displayName}: ${loginRes.error}` };
    }

    const { accessToken, accountId: senderAccountId } = loginRes;

    // 2. Resolve recipient username
    const recipientRes = await this.resolveDisplayName(recipientUsername, accessToken);
    if (!recipientRes.success) {
      return { success: false, error: recipientRes.error };
    }

    const { accountId: receiverAccountId, displayName: receiverDisplayName } = recipientRes;

    // 3. Fetch current shop to find matching offer
    const shopRes = await FortniteApiService.getShop();
    if (!shopRes.success) {
      return { success: false, error: 'Could not fetch current Fortnite shop' };
    }

    const entries = shopRes.data?.entries || [];
    const query = itemQuery.toLowerCase();

    const matchedEntry = entries.find((e) => {
      if (e.offerId && (e.offerId.toLowerCase().includes(query) || e.devName?.toLowerCase().includes(query))) return true;
      if (e.items && e.items.some((item) => item.name && item.name.toLowerCase().includes(query))) return true;
      if (e.tracks && e.tracks.some((t) => t.title && t.title.toLowerCase().includes(query))) return true;
      if (e.bundle && e.bundle.name && e.bundle.name.toLowerCase().includes(query)) return true;
      return false;
    });

    if (!matchedEntry) {
      return { success: false, error: `No giftable offer matching "**${itemQuery}**" found in the current Fortnite shop.` };
    }

    const offerId = matchedEntry.offerId;
    const price = matchedEntry.finalPrice || matchedEntry.regularPrice || 0;
    const itemName = matchedEntry.items?.[0]?.name || matchedEntry.tracks?.[0]?.title || matchedEntry.bundle?.name || itemQuery;

    // 4. Send Gift
    const giftRes = await this.giftCatalogEntry({
      accessToken,
      senderAccountId,
      receiverAccountId,
      offerId,
      expectedTotalPrice: price,
      personalMessage: message,
    });

    if (giftRes.success) {
      return {
        success: true,
        sender: senderAccount.displayName,
        recipient: receiverDisplayName,
        item: itemName,
        price,
      };
    }
    return { success: false, error: giftRes.error };
  }
}

module.exports = GiftingService;
