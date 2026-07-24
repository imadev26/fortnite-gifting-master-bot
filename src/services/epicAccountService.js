const axios = require('axios');
const EpicAuthService = require('./epicAuthService');

class EpicAccountService {
  /**
   * Fetch V-Bucks Balance for an Epic Games Account
   */
  static async getVBucksBalance(account) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(account);
      if (!loginRes.success) return { success: false, error: loginRes.error };

      const { accessToken, accountId } = loginRes;

      const response = await axios.post(
        `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=common_core&rvn=-1`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const items = response.data?.profileChanges?.[0]?.profile?.items || {};
      let totalVBucks = 0;

      Object.values(items).forEach((item) => {
        if (item.templateId && item.templateId.startsWith('Currency:Mtx')) {
          totalVBucks += item.quantity || 0;
        }
      });

      return { success: true, balance: totalVBucks, displayName: account.displayName };
    } catch (error) {
      console.error('Error fetching V-Bucks:', error.response?.data || error.message);
      return { success: false, error: 'Could not fetch V-Bucks balance' };
    }
  }

  /**
   * Fetch 24-Hour Gifting Count & Limits
   */
  static async getGiftingStats(account) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(account);
      if (!loginRes.success) return { success: false, error: loginRes.error };

      const { accessToken, accountId } = loginRes;

      const response = await axios.post(
        `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=common_core&rvn=-1`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const stats = response.data?.profileChanges?.[0]?.profile?.stats?.attributes || {};
      const giftHistory = stats.gift_history || {};
      const giftsSentCount = giftHistory.num_sent || 0;
      const maxDailyGifts = 5;
      const remainingGifts = Math.max(0, maxDailyGifts - giftsSentCount);

      return {
        success: true,
        sent: giftsSentCount,
        remaining: remainingGifts,
        max: maxDailyGifts,
        displayName: account.displayName,
      };
    } catch (error) {
      console.error('Error fetching gift stats:', error.response?.data || error.message);
      return { success: false, error: 'Could not fetch gifting limits' };
    }
  }

  /**
   * Remove a saved Epic Games Account
   */
  static removeAccount(accountId) {
    const accounts = EpicAuthService.getAccounts();
    const filtered = accounts.filter((a) => a.accountId !== accountId);

    if (filtered.length === accounts.length) {
      return { success: false, error: 'Account not found' };
    }

    EpicAuthService.saveAccounts(filtered);
    return { success: true, remaining: filtered.length };
  }

  /**
   * Send Epic Games Friend Request to target username
   */
  static async addFriend(account, targetUsername) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(account);
      if (!loginRes.success) return { success: false, error: loginRes.error };

      const { accessToken, accountId } = loginRes;

      // Resolve recipient account ID
      const userRes = await axios.get(
        `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${encodeURIComponent(targetUsername)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!userRes.data || !userRes.data.id) {
        return { success: false, error: 'Target user not found on Epic Games' };
      }

      const targetAccountId = userRes.data.id;
      const targetDisplayName = userRes.data.displayName;

      // Send Friend Request
      await axios.post(
        `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/public/friends/${accountId}/${targetAccountId}`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      return { success: true, targetDisplayName };
    } catch (error) {
      console.error('Error adding friend:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Friend request failed',
      };
    }
  }
}

module.exports = EpicAccountService;
