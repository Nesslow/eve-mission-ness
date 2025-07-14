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
   * Fetch price for a single item using fallback estimation
   */
  async function fetchItemPrice(itemName) {
    try {
      // Try EVE ESI API first (this is CORS-enabled)
      const price = await fetchESIPrice(itemName);
      if (price > 0) {
        return price;
      }
      
      // Fallback to item type estimation
      return estimateItemPrice(itemName);
      
    } catch (error) {
      console.warn(`Error fetching price for ${itemName}:`, error);
      return estimateItemPrice(itemName);
    }
  }

  /**
   * Attempt to fetch price using EVE ESI API
   */
  async function fetchESIPrice(itemName) {
    try {
      // First, we need to search for the item type ID
      const searchUrl = `https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=true`;
      
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      
      if (!searchData.inventory_type || searchData.inventory_type.length === 0) {
        throw new Error('Item not found in ESI search');
      }
      
      const typeId = searchData.inventory_type[0];
      
      // Get market orders for this item in the selected hub
      const hubIds = {
        'jita': 30000142,
        'amarr': 30002187,
        'dodixie': 30002659,
        'hek': 30002053,
        'rens': 30002510
      };
      
      const hubId = hubIds[currentPriceHub.toLowerCase()] || hubIds.jita;
      
      const ordersUrl = `https://esi.evetech.net/latest/markets/${hubId}/orders/?type_id=${typeId}&order_type=sell`;
      
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
      console.warn(`ESI API failed for ${itemName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize the market API and load any cached data
   */
  async function init() {
    try {
      // Get price hub setting
      const priceHub = await missionDB.getSetting('price-hub') || 'jita';
      setPriceHub(priceHub);
      
      // Get refresh setting
      const shouldRefresh = await missionDB.getSetting('refresh-prices-on-load');
      
      if (shouldRefresh !== false) {
        console.log('Market API: Initialization complete');
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing market API:', error);
      return false;
    }
  }

  /**
   * Enhanced price estimation with better category detection
   */
  function estimateItemPrice(itemName) {
    const name = itemName.toLowerCase();
    
    // Ship categories
    if (name.includes('titan')) {
      return 60000000000 + Math.random() * 40000000000; // 60-100B ISK
    } else if (name.includes('supercarrier')) {
      return 15000000000 + Math.random() * 10000000000; // 15-25B ISK
    } else if (name.includes('dreadnought')) {
      return 1500000000 + Math.random() * 1000000000; // 1.5-2.5B ISK
    } else if (name.includes('carrier')) {
      return 1000000000 + Math.random() * 500000000; // 1-1.5B ISK
    } else if (name.includes('battleship')) {
      return 150000000 + Math.random() * 200000000; // 150-350M ISK
    } else if (name.includes('cruiser')) {
      return 30000000 + Math.random() * 50000000; // 30-80M ISK
    } else if (name.includes('battlecruiser')) {
      return 50000000 + Math.random() * 100000000; // 50-150M ISK
    } else if (name.includes('frigate')) {
      return 1000000 + Math.random() * 5000000; // 1-6M ISK
    } else if (name.includes('destroyer')) {
      return 2000000 + Math.random() * 8000000; // 2-10M ISK
    } 
    
    // Module categories
    else if (name.includes('hardener') || name.includes('armor') || name.includes('shield')) {
      if (name.includes('t2') || name.includes('ii')) {
        return 500000 + Math.random() * 2000000; // 500K-2.5M ISK
      } else {
        return 50000 + Math.random() * 200000; // 50K-250K ISK
      }
    } else if (name.includes('gun') || name.includes('turret') || name.includes('launcher')) {
      if (name.includes('t2') || name.includes('ii')) {
        return 1000000 + Math.random() * 5000000; // 1-6M ISK
      } else {
        return 100000 + Math.random() * 500000; // 100K-600K ISK
      }
    } else if (name.includes('plate') || name.includes('extender')) {
      return 100000 + Math.random() * 400000; // 100K-500K ISK
    } else if (name.includes('battery') || name.includes('capacitor')) {
      return 200000 + Math.random() * 800000; // 200K-1M ISK
    } else if (name.includes('repair') || name.includes('booster')) {
      return 300000 + Math.random() * 1200000; // 300K-1.5M ISK
    } else if (name.includes('blaster') || name.includes('cannon') || name.includes('beam')) {
      return 150000 + Math.random() * 600000; // 150K-750K ISK
    }
    
    // Ammunition and consumables
    else if (name.includes('ammunition') || name.includes('charge')) {
      return 10 + Math.random() * 1000; // 10-1010 ISK
    } else if (name.includes('crystal') || name.includes('lens')) {
      return 1000 + Math.random() * 10000; // 1K-11K ISK
    }
    
    // Resources and materials
    else if (name.includes('ore') || name.includes('mineral')) {
      return 100 + Math.random() * 5000; // 100-5100 ISK
    } else if (name.includes('blueprint')) {
      return 5000000 + Math.random() * 50000000; // 5-55M ISK
    } else if (name.includes('datacores') || name.includes('datacore')) {
      return 50000 + Math.random() * 500000; // 50K-550K ISK
    }
    
    // Implants and boosters
    else if (name.includes('implant')) {
      return 10000000 + Math.random() * 100000000; // 10-110M ISK
    } else if (name.includes('booster')) {
      return 1000000 + Math.random() * 10000000; // 1-11M ISK
    }
    
    // Default for unknown items
    else {
      return 25000 + Math.random() * 75000; // 25K-100K ISK
    }
  }

  /**
   * Batch price lookup for multiple items
   * @param {Array} items - Array of { name, quantity }
   * @returns {Promise<Object>} - Map of item name to price
   */
  async function getBatchItemPrices(items) {
    const priceMap = {};
    
    // Process items in smaller batches to avoid overwhelming the API
    const batchSize = 3;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process each item in the batch
      const batchPromises = batch.map(async (item) => {
        try {
          const price = await getItemPrice(item.name);
          return { name: item.name, price: price };
        } catch (error) {
          console.warn(`Failed to get price for ${item.name}:`, error);
          return { name: item.name, price: estimateItemPrice(item.name) };
        }
      });
      
      try {
        const batchResults = await Promise.all(batchPromises);
        
        // Add results to price map
        batchResults.forEach(result => {
          priceMap[result.name] = result.price;
        });
        
        // Add a small delay between batches to be respectful to the API
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.warn('Batch processing failed:', error);
        
        // Fallback to estimation for this batch
        batch.forEach(item => {
          priceMap[item.name] = estimateItemPrice(item.name);
        });
      }
    }
    
    return priceMap;
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

  // Public API
  return {
    getItemPrice,
    getBatchItemPrices,
    refreshCache,
    setPriceHub,
    init
  };
})();