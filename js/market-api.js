/**
 * Market API Integration for EVE Mission Tracker
 * Fetches prices from EVE market APIs
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
  
  // Fixed to Jita for now
  const JITA_STATION_ID = 30000142;
  
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
      
      // Get market orders for this item in Jita
      const ordersUrl = `https://esi.evetech.net/latest/markets/${JITA_STATION_ID}/orders/?type_id=${typeId}&order_type=sell`;
      
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
   * Find type ID by item name using the Fuzzwork API
   */
  async function findTypeIdByName(itemName) {
    // Normalize the item name for caching
    const normalizedName = itemName.toLowerCase().trim();
    
    // Check cache first
    if (typeIdCache[normalizedName]) {
      return typeIdCache[normalizedName];
    }
    
    try {
      // Rate limiting: ensure we don't overwhelm the API
      const now = Date.now();
      const timeSinceLastCall = now - lastApiCall;
      if (timeSinceLastCall < MIN_API_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall));
      }
      
      // Use the Fuzzwork API to resolve item names to type IDs
      const apiUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemName)}`;
      
      lastApiCall = Date.now();
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Fuzzwork API failed: ${response.status}`);
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
      console.error(`Fuzzwork API lookup failed for "${itemName}":`, error.message);
      throw error;
    }
  }

  // Public API
  return {
    getItemPrice,
    clearAllCaches
  };
})();