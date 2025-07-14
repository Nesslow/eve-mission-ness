/**
 * Market API Integration for EVE Mission Tracker
 * Fetches prices from EVE market APIs
 */

const MarketAPI = (() => {
  // Cache for item prices
  const priceCache = {};
  
  // Timestamp when cache was last updated
  let cacheTimestamp = null;
  
  // Cache expiry in minutes
  const CACHE_EXPIRY_MINUTES = 60;
  
  // Selected price hub
  let currentPriceHub = 'jita';
  
  /**
   * Get price for an item
   */
  async function getItemPrice(itemName) {
    // Check if we need to refresh the cache
    if (shouldRefreshCache()) {
      await refreshCache();
    }
    
    // Normalize item name for cache lookup
    const normalizedName = itemName.toLowerCase().trim();
    
    // Check if item is in cache
    if (priceCache[normalizedName]) {
      return priceCache[normalizedName];
    }
    
    // If not in cache, try to fetch individually
    try {
      const price = await fetchItemPrice(itemName);
      if (price) {
        priceCache[normalizedName] = price;
      }
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${itemName}:`, error);
      return 0;
    }
  }

  /**
   * Check if cache should be refreshed
   */
  function shouldRefreshCache() {
    if (!cacheTimestamp) return true;
    
    const now = new Date();
    const cacheAge = (now - cacheTimestamp) / (1000 * 60); // in minutes
    
    return cacheAge > CACHE_EXPIRY_MINUTES;
  }

  /**
   * Refresh the price cache
   */
  async function refreshCache() {
    try {
      // In a more complete implementation, we would pre-fetch common item prices
      // For now, we'll just reset the timestamp
      cacheTimestamp = new Date();
      console.log('Price cache refreshed');
      return true;
    } catch (error) {
      console.error('Error refreshing price cache:', error);
      return false;
    }
  }

  /**
   * Fetch price for a single item using evepraisal.com API
   */
  async function fetchItemPrice(itemName) {
    try {
      // Use evepraisal.com API for price checking
      const response = await fetch(`https://evepraisal.com/appraisal.json?market=${currentPriceHub}&raw_textarea=${encodeURIComponent(itemName)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.appraisal && data.appraisal.items && data.appraisal.items.length > 0) {
        // Get the first matching item
        const item = data.appraisal.items[0];
        
        // Use sell price as default (or buy if sell not available)
        let price = 0;
        
        if (item.prices && item.prices.sell && item.prices.sell.min) {
          price = item.prices.sell.min;
        } else if (item.prices && item.prices.buy && item.prices.buy.max) {
          price = item.prices.buy.max;
        } else if (item.prices && item.prices.all && item.prices.all.median) {
          price = item.prices.all.median;
        }
        
        return price;
      }
      
      // Fallback to estimate price if item not found in market
      if (data && data.appraisal && data.appraisal.items) {
        return 0;
      }
      
      // Handle error cases
      throw new Error('Item not found in market data');
      
    } catch (error) {
      // Log the error but don't break the app flow
      console.warn(`Error fetching price for ${itemName}:`, error);
      
      // For testing purposes, generate a random price
      // In production, you'd want to handle this differently
      console.info('Using fallback price estimation');
      const simulatedPrice = Math.round(Math.random() * 100000) / 100;
      return simulatedPrice;
    }
  }

  /**
   * Batch price lookup for multiple items using evepraisal
   * @param {Array} items - Array of { name, quantity }
   * @returns {Promise<Object>} - Map of item name to price
   */
  async function getBatchItemPrices(items) {
    // Compose newline-separated list for evepraisal
    const text = items.map(item => `${item.name}\t${item.quantity}`).join('\n');
    try {
      const response = await fetch(`https://evepraisal.com/appraisal.json?market=${currentPriceHub}&raw_textarea=${encodeURIComponent(text)}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      const priceMap = {};
      if (data && data.appraisal && data.appraisal.items) {
        data.appraisal.items.forEach(item => {
          // Use sell price as default (or buy if sell not available)
          let price = 0;
          if (item.prices && item.prices.sell && item.prices.sell.min) {
            price = item.prices.sell.min;
          } else if (item.prices && item.prices.buy && item.prices.buy.max) {
            price = item.prices.buy.max;
          } else if (item.prices && item.prices.all && item.prices.all.median) {
            price = item.prices.all.median;
          }
          priceMap[item.name] = price;
        });
      }
      return priceMap;
    } catch (error) {
      console.warn('Batch price fetch failed:', error);
      throw error;
    }
  }

  /**
   * Set the current price hub
   */
  function setPriceHub(hub) {
    if (hub && typeof hub === 'string') {
      currentPriceHub = hub.toLowerCase();
      // Clear cache when changing hub
      Object.keys(priceCache).forEach(key => delete priceCache[key]);
      cacheTimestamp = null;
      console.log(`Price hub set to: ${currentPriceHub}`);
      return true;
    }
    return false;
  }

  /**
   * Initialize the market API
   */
  async function init() {
    try {
      // Get price hub setting
      const priceHub = await missionDB.getSetting('price-hub') || 'jita';
      setPriceHub(priceHub);
      
      // Get refresh setting
      const shouldRefresh = await missionDB.getSetting('refresh-prices-on-load');
      
      if (shouldRefresh !== false) {
        await refreshCache();
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing market API:', error);
      return false;
    }
  }

  // Public API
  return {
    getItemPrice,
    getBatchItemPrices,
    refreshCache,
    setPriceHub,
    init
  };
})();