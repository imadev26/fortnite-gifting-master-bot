const axios = require('axios');
const config = require('../config');

const apiClient = axios.create({
  baseURL: 'https://fortnite-api.com',
  timeout: 10000,
  headers: config.fortniteApiKey ? { Authorization: config.fortniteApiKey } : {},
});

/**
 * Service to interact with ALL Fortnite-API.com endpoints
 */
class FortniteApiService {
  /**
   * Fetch current Item Shop (/v2/shop)
   */
  static async getShop(language = 'en') {
    try {
      const response = await apiClient.get('/v2/shop', { params: { language } });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Failed to retrieve shop data' };
    } catch (error) {
      console.error('Error fetching Fortnite shop:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Unable to fetch shop' };
    }
  }

  /**
   * Fetch BR Player Statistics by name
   */
  static async getStats(username, accountType = 'epic', timeWindow = 'lifetime') {
    try {
      const response = await apiClient.get('/v2/stats/br/v2', {
        params: { name: username, accountType, timeWindow, image: 'all' },
      });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Player stats not found or profile is private' };
    } catch (error) {
      console.error('Error fetching Fortnite stats:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || 'Player not found or profile is private.',
      };
    }
  }

  /**
   * Fetch latest Battle Royale News
   */
  static async getNews(language = 'en') {
    try {
      const response = await apiClient.get('/v2/news/br', { params: { language } });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Failed to retrieve Fortnite news' };
    } catch (error) {
      console.error('Error fetching Fortnite news:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Unable to fetch news' };
    }
  }

  /**
   * Fetch current Battle Royale Map
   */
  static async getMap(language = 'en') {
    try {
      const response = await apiClient.get('/v1/map', { params: { language } });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Failed to fetch Fortnite map' };
    } catch (error) {
      console.error('Error fetching Fortnite map:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Unable to fetch map' };
    }
  }

  /**
   * Search for any cosmetic item (Skins, Pickaxes, Emotes, etc.)
   */
  static async searchCosmetic(name, language = 'en') {
    try {
      const response = await apiClient.get('/v2/cosmetics/br/search', {
        params: { name, language, matchMethod: 'contains' },
      });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Cosmetic item not found' };
    } catch (error) {
      console.error('Error searching cosmetic:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Item not found' };
    }
  }

  /**
   * Fetch latest Fortnite AES Keys & Build Version
   */
  static async getAes() {
    try {
      const response = await apiClient.get('/v2/aes');
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Failed to fetch AES keys' };
    } catch (error) {
      console.error('Error fetching AES keys:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Unable to fetch AES keys' };
    }
  }

  /**
   * Search for a Support-A-Creator Code
   */
  static async getCreatorCode(code) {
    try {
      const response = await apiClient.get('/v2/creatorcode', { params: { name: code } });
      if (response.data && response.data.status === 200) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: 'Creator Code not found' };
    } catch (error) {
      console.error('Error fetching Creator Code:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || 'Creator Code invalid or inactive' };
    }
  }
}

module.exports = FortniteApiService;
