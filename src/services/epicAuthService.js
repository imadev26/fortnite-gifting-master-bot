const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, '../../data/accounts.json');

// Active Fortnite Android Game Client credentials
const EPIC_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const EPIC_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';
const BASIC_AUTH = Buffer.from(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`).toString('base64');

class EpicAuthService {
  /**
   * In-memory token cache: Map<accountId, { accessToken, expiresAt }>
   * Epic tokens are valid for 8 hours — we cache them to avoid redundant logins.
   */
  static tokenCache = new Map();

  /**
   * Returns the official Epic Games login authorization URL
   */
  static getAuthUrl() {
    return `https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fredirect%3FclientId%3D${EPIC_CLIENT_ID}%26responseType%3Dcode`;
  }

  /**
   * Load saved deviceAuth accounts from JSON file
   */
  static getAccounts() {
    try {
      if (!fs.existsSync(ACCOUNTS_FILE)) {
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([]));
        return [];
      }
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('Error reading accounts.json:', err);
      return [];
    }
  }

  /**
   * Save accounts list to JSON file
   */
  static saveAccounts(accounts) {
    try {
      const dir = path.dirname(ACCOUNTS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    } catch (err) {
      console.error('Error saving accounts.json:', err);
    }
  }

  /**
   * Exchange an Authorization Code for DeviceAuth & store it
   */
  static async createDeviceAuthFromCode(code) {
    try {
      // Clean code parameter if user copied full JSON or query string
      let cleanCode = code.trim();
      if (cleanCode.includes('"authorizationCode":"')) {
        const match = cleanCode.match(/"authorizationCode":"([^"]+)"/);
        if (match) cleanCode = match[1];
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', cleanCode);

      const tokenRes = await axios.post(
        'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token',
        params,
        {
          headers: {
            Authorization: `Basic ${BASIC_AUTH}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData = tokenRes.data;
      const accountId = tokenData.account_id;
      const accessToken = tokenData.access_token;
      const displayName = tokenData.displayName || accountId;

      // Create Device Auth credentials for persistent login
      const deviceAuthRes = await axios.post(
        `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}/deviceAuth`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const deviceData = deviceAuthRes.data;
      const newAccount = {
        accountId: deviceData.accountId,
        deviceId: deviceData.deviceId,
        secret: deviceData.secret,
        displayName,
        addedAt: new Date().toISOString(),
      };

      const accounts = this.getAccounts();
      const existingIdx = accounts.findIndex((a) => a.accountId === newAccount.accountId);
      if (existingIdx >= 0) {
        accounts[existingIdx] = newAccount;
      } else {
        accounts.push(newAccount);
      }
      this.saveAccounts(accounts);

      // Automatically set Creator Code 'xzerk' for any newly added Epic account
      try {
        await axios.post(
          `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/SetAffiliateName?rvn=-1`,
          { affiliateName: 'xzerk' },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(`🌟 Automatically applied Creator Code 'xzerk' for new account: ${displayName}`);
      } catch (sacErr) {
        console.warn(`Could not auto-apply SAC 'xzerk' for ${displayName}:`, sacErr.message);
      }

      return { success: true, account: newAccount, accessToken };
    } catch (error) {
      console.error('Error creating deviceAuth:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message || 'Invalid or expired code.',
      };
    }
  }

  /**
   * Log in an existing saved account using deviceAuth credentials.
   * Returns cached token if still valid (Epic tokens last 8 hours).
   */
  static async loginWithDeviceAuth(account) {
    // Check cache first
    const cached = this.tokenCache.get(account.accountId);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        success: true,
        accessToken: cached.accessToken,
        displayName: cached.displayName || account.displayName,
        accountId: account.accountId,
      };
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'device_auth');
      params.append('account_id', account.accountId);
      params.append('device_id', account.deviceId);
      params.append('secret', account.secret);

      const response = await axios.post(
        'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token',
        params,
        {
          headers: {
            Authorization: `Basic ${BASIC_AUTH}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const result = {
        success: true,
        accessToken: response.data.access_token,
        displayName: response.data.displayName || account.displayName,
        accountId: response.data.account_id,
      };

      // Cache token — expires in 8h, invalidate 5min early to be safe
      this.tokenCache.set(account.accountId, {
        accessToken: result.accessToken,
        displayName: result.displayName,
        expiresAt: Date.now() + (8 * 60 * 60 * 1000) - (5 * 60 * 1000),
      });

      return result;
    } catch (error) {
      console.error(`Login failed for ${account.displayName}:`, error.response?.data || error.message);
      // Clear stale cache on auth failure
      this.tokenCache.delete(account.accountId);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'DeviceAuth token expired or invalid',
      };
    }
  }
}

module.exports = EpicAuthService;

