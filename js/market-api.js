/**
 * Market API Integration for EVE Mission Tracker
 * Uses ESI API to get top 5% average sell prices in Jita IV - Moon 4 - Caldari Navy Assembly Plant
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
  
  // Jita IV - Moon 4 - Caldari Navy Assembly Plant station ID
  const JITA_STATION_ID = 60003760;
  
  /**
   * Get top 5% average sell price for an item in Jita
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
   * Get prices for multiple items (batch processing)
   */
  async function getBatchItemPrices(items) {
    const results = [];
    
    for (const item of items) {
      try {
        const price = await getItemPrice(item.name);
        results.push({
          name: item.name,
          quantity: item.quantity || 1,
          unitPrice: price,
          totalPrice: price * (item.quantity || 1),
          success: true
        });
      } catch (error) {
        results.push({
          name: item.name,
          quantity: item.quantity || 1,
          unitPrice: 0,
          totalPrice: 0,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
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
   * Fetch top 5% average sell price for a single item in Jita
   */
  async function fetchItemPrice(itemName) {
    try {
      // Get the type ID for this item
      const typeId = await findTypeIdByName(itemName);
      
      if (!typeId) {
        throw new Error(`Item type ID not found for: ${itemName}`);
      }
      
      // Get sell orders for this item in The Forge region
      const ordersUrl = `https://esi.evetech.net/latest/markets/${THE_FORGE_REGION_ID}/orders/?type_id=${typeId}&order_type=sell`;
      
      const ordersResponse = await fetch(ordersUrl);
      if (!ordersResponse.ok) {
        throw new Error(`Orders fetch failed: ${ordersResponse.status}`);
      }
      
      const orders = await ordersResponse.json();
      
      if (!orders || orders.length === 0) {
        throw new Error('No market orders found');
      }
      
      // Filter to only Jita station orders
      const jitaOrders = orders.filter(order => 
        order.location_id === JITA_STATION_ID && 
        order.is_buy_order === false
      );
      
      if (jitaOrders.length === 0) {
        throw new Error('No sell orders found in Jita IV - Moon 4 - Caldari Navy Assembly Plant');
      }
      
      // Calculate top 5% average price
      const top5PercentPrice = calculateTop5PercentAverage(jitaOrders);
      
      return top5PercentPrice;
      
    } catch (error) {
      console.error(`Failed to fetch price for ${itemName}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate average of lowest 5% of orders in Jita
   */
  function calculateTop5PercentAverage(orders) {
    // Sort orders by price (lowest first)
    const sortedOrders = orders.sort((a, b) => a.price - b.price);
    
    // Calculate top 5% (minimum 1 order)
    const top5Count = Math.max(1, Math.ceil(sortedOrders.length * 0.05));
    const top5Orders = sortedOrders.slice(0, top5Count);
    
    // Calculate average price
    const totalPrice = top5Orders.reduce((sum, order) => sum + order.price, 0);
    const averagePrice = totalPrice / top5Orders.length;
    
    return Math.round(averagePrice * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Find type ID by item name
   */
  async function findTypeIdByName(itemName) {
    // Normalize the item name for caching
    const normalizedName = itemName.toLowerCase().trim();
    
    // Check cache first
    if (typeIdCache[normalizedName]) {
      return typeIdCache[normalizedName];
    }
    
    try {
      // Common items cache for faster lookup
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
      
      // Use Fuzzwork API for type ID lookup
      await rateLimitedFetch();
      
      const apiUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemName)}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Type ID lookup failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      let typeId = null;
      
      // Handle API response format
      if (Array.isArray(data)) {
        typeId = data.length > 0 ? data[0].typeID : null;
      } else if (data.typeID) {
        typeId = data.typeID;
      }
      
      // Cache the result
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
    getBatchItemPrices,
    clearAllCaches
  };
})();