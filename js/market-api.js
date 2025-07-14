/**
 * Market API Integration for EVE Mission Tracker
 * Uses only ESI (EVE Swagger Interface) API
 */

const MarketAPI = (() => {
  // Cache for item prices
  const priceCache = {};
  
  // Cache for type ID lookups
  const typeIdCache = {};
  
  // Timestamp when cache was last updated
  let cacheTimestamp = null;
  
  // Cache expiry in minutes
  const CACHE_EXPIRY_MINUTES = 60;
  
  // Rate limiting for API calls
  let lastApiCall = 0;
  const MIN_API_INTERVAL = 100; // 100ms between API calls
  
  // The Forge region ID (where Jita is located)
  const THE_FORGE_REGION_ID = 10000002;
  
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
    
    // If not in cache, try to fetch from API
    try {
      const price = await fetchItemPrice(itemName);
      
      // Cache the result
      priceCache[normalizedName] = price;
      
      return price;
    } catch (error) {
      console.error(`Error fetching price for "${itemName}":`, error.message);
      throw error;
    }
  }

  /**
   * Check if we should refresh the cache
   */
  function shouldRefreshCache() {
    if (!cacheTimestamp) return true;
    
    const now = Date.now();
    const cacheAge = (now - cacheTimestamp) / (1000 * 60); // in minutes
    
    return cacheAge > CACHE_EXPIRY_MINUTES;
  }

  /**
   * Refresh the price cache
   */
  async function refreshCache() {
    try {
      cacheTimestamp = Date.now();
      console.log('Price cache refreshed');
      return true;
    } catch (error) {
      console.error('Error refreshing price cache:', error);
      return false;
    }
  }

  /**
   * Clear all caches
   */
  function clearAllCaches() {
    Object.keys(priceCache).forEach(key => delete priceCache[key]);
    Object.keys(typeIdCache).forEach(key => delete typeIdCache[key]);
    cacheTimestamp = null;
    console.log('All caches cleared');
  }

  /**
   * Fetch price for a single item
   */
  async function fetchItemPrice(itemName) {
    try {
      // Get the type ID for this item
      const typeId = await findTypeIdByName(itemName);
      
      if (!typeId) {
        throw new Error(`Item type ID not found for: ${itemName}`);
      }
      
      // Get market orders for this item in The Forge region
      const ordersUrl = `https://esi.evetech.net/latest/markets/${THE_FORGE_REGION_ID}/orders/?type_id=${typeId}&order_type=sell`;
      
      const ordersResponse = await fetch(ordersUrl);
      if (!ordersResponse.ok) {
        throw new Error(`Orders fetch failed: ${ordersResponse.status}`);
      }
      
      const orders = await ordersResponse.json();
      
      if (!orders || orders.length === 0) {
        throw new Error('No market orders found');
      }
      
      // Find the lowest sell order
      const sellOrders = orders.filter(order => order.is_buy_order === false);
      if (sellOrders.length === 0) {
        throw new Error('No sell orders found');
      }
      
      const lowestPrice = Math.min(...sellOrders.map(order => order.price));
      return lowestPrice;
      
    } catch (error) {
      console.error(`Failed to fetch price for ${itemName}:`, error.message);
      throw error;
    }
  }

  /**
   * Find type ID by item name using ESI API
   */
  async function findTypeIdByName(itemName) {
    // Normalize the item name for caching
    const normalizedName = itemName.toLowerCase().trim();
    
    // Check cache first
    if (typeIdCache[normalizedName]) {
      return typeIdCache[normalizedName];
    }
    
    try {
      // For now, we'll use a hybrid approach:
      // 1. Try common items first (fast lookup)
      // 2. If not found, fall back to Fuzzwork API (more reliable than loading all ESI data)
      
      const commonItems = {
        'rifter': 587,
        'merlin': 603,
        'punisher': 625,
        'tristan': 582,
        'atron': 608,
        'incursus': 606,
        'kestrel': 602,
        'venture': 32880,
        'plex': 29668,
        'skill injector': 40519,
        'skill extractor': 40520,
        'damage control i': 519,
        'small armor repairer i': 518,
        'small shield booster i': 3831
      };
      
      // Check common items first
      if (commonItems[normalizedName]) {
        typeIdCache[normalizedName] = commonItems[normalizedName];
        return commonItems[normalizedName];
      }
      
      // If not in common items, use Fuzzwork API as fallback
      // (This is more reliable than loading all ESI type data)
      await rateLimitedFetch();
      
      const apiUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemName)}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Type ID lookup failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      let typeId = null;
      
      // The API returns either a single result or an array of results
      if (Array.isArray(data)) {
        // If multiple results, take the first one
        typeId = data.length > 0 ? data[0].typeID : null;
      } else if (data.typeID) {
        // Single result
        typeId = data.typeID;
      }
      
      // Cache the result (even if null to avoid repeated failed lookups)
      typeIdCache[normalizedName] = typeId;
      
      return typeId;
      
    } catch (error) {
      console.error(`Type ID lookup failed for "${itemName}":`, error.message);
      throw error;
    }
  }

  /**
   * Rate limiting helper
   */
  async function rateLimitedFetch() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall));
    }
    lastApiCall = Date.now();
  }

  // Public API
  return {
    getItemPrice,
    clearAllCaches
  };
})();