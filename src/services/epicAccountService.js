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
      // Epic API returns num_sent directly, or we count sentTo array entries as fallback
      const giftsSentCount = giftHistory.num_sent ?? giftHistory.sentTo?.length ?? 0;
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
        `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${targetAccountId}`,
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

  /**
   * Fetch the full friends list for an account (accepted friends only)
   * Returns: { success, friends: [{accountId, displayName}] }
   */
  static async getFriendsList(account) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(account);
      if (!loginRes.success) return { success: false, error: loginRes.error };

      const { accessToken, accountId } = loginRes;

      // Step 1: Get list of friend accountIds
      const friendsRes = await axios.get(
        `https://friends-public-service-prod.ol.epicgames.com/friends/api/public/friends/${accountId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const rawFriends = friendsRes.data || [];
      const acceptedIds = rawFriends
        .filter((f) => f.status === 'ACCEPTED')
        .map((f) => f.accountId);

      if (!acceptedIds.length) {
        return { success: true, friends: [] };
      }

      // Step 2: Batch-resolve display names (max 100 per request)
      const batchSize = 100;
      const friends = [];

      for (let i = 0; i < acceptedIds.length; i += batchSize) {
        const batch = acceptedIds.slice(i, i + batchSize);
        const query = batch.map((id) => `accountId=${id}`).join('&');
        const namesRes = await axios.get(
          `https://account-public-service-prod.ol.epicgames.com/account/api/public/account?${query}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const resolved = namesRes.data || [];
        resolved.forEach((u) => {
          if (u && u.id && u.displayName) {
            const ext = u.externalAuths || {};
            const keys = Object.keys(ext);
            let platform = 'Epic';
            let icon = '🖥️';
            if (keys.includes('psn')) { platform = 'PSN'; icon = '🎮'; }
            else if (keys.includes('xbl')) { platform = 'Xbox'; icon = '💚'; }
            else if (keys.includes('nintendo') || keys.includes('switch')) { platform = 'Switch'; icon = '🔴'; }
            friends.push({ accountId: u.id, displayName: u.displayName, platform, icon });
          }
        });
      }

      // Sort alphabetically
      friends.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

      return { success: true, friends };
    } catch (error) {
      console.error('Error fetching friends list:', error.response?.data || error.message);
      return { success: false, error: 'Could not fetch friends list from Epic Games' };
    }
  }

  /**
   * Bulk Sync / Transfer Friends List from sourceAccount to targetAccount
   * Sends Epic friend requests from targetAccount to every friend of sourceAccount
   */
  static async syncFriendsList(sourceAccount, targetAccount, onProgress) {
    try {
      const sourceRes = await this.getFriendsList(sourceAccount);
      if (!sourceRes.success) return { success: false, error: `Could not fetch friends from ${sourceAccount.displayName}` };

      const friends = sourceRes.friends || [];
      if (!friends.length) return { success: false, error: `${sourceAccount.displayName} has no friends to transfer.` };

      const targetLogin = await EpicAuthService.loginWithDeviceAuth(targetAccount);
      if (!targetLogin.success) return { success: false, error: `Login failed for target ${targetAccount.displayName}` };

      const { accessToken, accountId: targetAccountId } = targetLogin;

      let sentCount = 0;
      let failCount = 0;
      const total = friends.length;

      for (let i = 0; i < total; i++) {
        const friend = friends[i];

        if (onProgress) {
          try {
            await onProgress(i + 1, total, friend.displayName, sentCount, failCount);
          } catch (_) {}
        }

        try {
          await axios.post(
            `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${targetAccountId}/friends/${friend.accountId}`,
            {},
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          sentCount++;
        } catch (e) {
          failCount++;
        }

        await new Promise((r) => setTimeout(r, 250));
      }

      return {
        success: true,
        total,
        sentCount,
        failCount,
        source: sourceAccount.displayName,
        target: targetAccount.displayName,
      };
    } catch (error) {
      console.error('Error in syncFriendsList:', error.message);
      return { success: false, error: 'Bulk friend sync failed.' };
    }
  }

  /**
   * Check & accept all incoming pending friend requests for an account
   */
  static async acceptPendingFriends(account) {
    try {
      const loginRes = await EpicAuthService.loginWithDeviceAuth(account);
      if (!loginRes.success) return { success: false, error: loginRes.error };

      const { accessToken, accountId } = loginRes;

      // Get raw friends list
      const friendsRes = await axios.get(
        `https://friends-public-service-prod.ol.epicgames.com/friends/api/public/friends/${accountId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const rawFriends = friendsRes.data || [];
      const pendingInbound = rawFriends.filter(
        (f) => f.status === 'PENDING' && f.direction === 'INBOUND'
      );

      if (!pendingInbound.length) {
        return { success: true, acceptedCount: 0, acceptedNames: [], accountName: account.displayName };
      }

      // Batch-resolve display names of senders
      const pendingIds = pendingInbound.map((f) => f.accountId);
      const query = pendingIds.map((id) => `accountId=${id}`).join('&');
      const namesRes = await axios.get(
        `https://account-public-service-prod.ol.epicgames.com/account/api/public/account?${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const resolvedMap = new Map((namesRes.data || []).map((u) => [u.id, u.displayName]));
      const acceptedNames = [];

      // Accept each pending request
      for (const p of pendingInbound) {
        try {
          await axios.post(
            `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${p.accountId}`,
            {},
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const name = resolvedMap.get(p.accountId) || p.accountId;
          acceptedNames.push(name);
        } catch (e) {
          console.error(`Error accepting friend request from ${p.accountId}:`, e.message);
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      return {
        success: true,
        acceptedCount: acceptedNames.length,
        acceptedNames,
        accountName: account.displayName,
      };
    } catch (error) {
      console.error('Error accepting pending friends:', error.message);
      return { success: false, error: 'Could not process pending friend requests.' };
    }
  }
}

module.exports = EpicAccountService;
