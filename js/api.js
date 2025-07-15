// External API call logic (Fuzzwork, ESI)
console.log("api.js loaded");

// Fuzzwork API endpoints
const FUZZWORK_API_BASE = 'https://market.fuzzwork.co.uk/api/';

// ESI API endpoints and constants
const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const THE_FORGE_REGION_ID = 10000002;
const JITA_4_4_STATION_ID = 60003760;

/**
 * Convert item names to type IDs using Fuzzwork API
 * @param {string[]} itemNames - Array of item names to lookup
 * @returns {Promise<Map<string, number>>} - Map of item names to type IDs
 */
async function getTypeIds(itemNames) {
    if (!itemNames || itemNames.length === 0) {
        return new Map();
    }

    const typeIds = new Map();
    
    try {
        // Use the Fuzzwork search API to get type IDs
        // We'll make individual requests for each item for simplicity
        const promises = itemNames.map(async (itemName) => {
            try {
                const response = await fetch(`${FUZZWORK_API_BASE}search?q=${encodeURIComponent(itemName)}`);
                if (!response.ok) {
                    console.warn(`Failed to get type ID for ${itemName}: ${response.status}`);
                    return null;
                }
                
                const data = await response.json();
                
                // Find exact match (case-insensitive)
                const exactMatch = data.find(item => 
                    item.name.toLowerCase() === itemName.toLowerCase()
                );
                
                if (exactMatch) {
                    return { name: itemName, typeId: exactMatch.id };
                } else {
                    console.warn(`No exact match found for item: ${itemName}`);
                    return null;
                }
            } catch (error) {
                console.error(`Error fetching type ID for ${itemName}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        
        results.forEach(result => {
            if (result) {
                typeIds.set(result.name, result.typeId);
            }
        });
        
    } catch (error) {
        console.error('Error in getTypeIds:', error);
    }
    
    return typeIds;
}

/**
 * Get market prices for type IDs using ESI API
 * @param {number[]} typeIds - Array of type IDs to get prices for
 * @returns {Promise<Map<number, number>>} - Map of type IDs to prices
 */
async function getPrices(typeIds) {
    if (!typeIds || typeIds.length === 0) {
        return new Map();
    }

    const prices = new Map();
    
    try {
        // Process each type ID individually to get accurate Jita pricing
        const pricePromises = typeIds.map(async (typeId) => {
            try {
                console.log(`Fetching market data for type ID: ${typeId}`);
                
                // Step 1: Fetch all sell orders from The Forge region
                const response = await fetch(`${ESI_BASE_URL}/markets/${THE_FORGE_REGION_ID}/orders?type_id=${typeId}&order_type=sell`);
                
                if (!response.ok) {
                    console.warn(`Failed to get market data for type ID ${typeId}: ${response.status}`);
                    return { typeId, price: null };
                }
                
                const allOrders = await response.json();
                
                // Step 2: Filter orders to include only those at Jita 4-4 station
                const jitaOrders = allOrders.filter(order => order.location_id === JITA_4_4_STATION_ID);
                
                if (jitaOrders.length === 0) {
                    console.warn(`No sell orders found at Jita 4-4 for type ID ${typeId}`);
                    return { typeId, price: null };
                }
                
                // Step 3: Sort filtered orders by price in ascending order
                jitaOrders.sort((a, b) => a.price - b.price);
                
                // Step 4: Calculate volume of the lowest 5% of orders
                const totalVolume = jitaOrders.reduce((sum, order) => sum + order.volume_remain, 0);
                const targetVolume = totalVolume * 0.05; // 5% of total volume
                
                // Step 5: Determine weighted average price of the lowest 5% volume
                let accumulatedVolume = 0;
                let weightedSum = 0;
                let totalWeightedVolume = 0;
                
                for (const order of jitaOrders) {
                    const availableVolume = order.volume_remain;
                    const volumeToUse = Math.min(availableVolume, targetVolume - accumulatedVolume);
                    
                    if (volumeToUse > 0) {
                        weightedSum += order.price * volumeToUse;
                        totalWeightedVolume += volumeToUse;
                        accumulatedVolume += volumeToUse;
                    }
                    
                    if (accumulatedVolume >= targetVolume) {
                        break;
                    }
                }
                
                // If we couldn't get enough volume from the lowest 5%, use what we have
                if (totalWeightedVolume === 0) {
                    // Fallback to lowest price if no volume in lowest 5%
                    const lowestPrice = jitaOrders[0].price;
                    console.log(`Type ID ${typeId}: Using lowest price ${lowestPrice} ISK (no volume in lowest 5%)`);
                    return { typeId, price: lowestPrice };
                }
                
                const weightedAveragePrice = weightedSum / totalWeightedVolume;
                console.log(`Type ID ${typeId}: Weighted average price ${weightedAveragePrice.toFixed(2)} ISK from ${totalWeightedVolume} volume`);
                
                return { typeId, price: weightedAveragePrice };
                
            } catch (error) {
                console.error(`Error fetching price for type ID ${typeId}:`, error);
                return { typeId, price: null };
            }
        });
        
        // Wait for all price fetches to complete
        const results = await Promise.all(pricePromises);
        
        // Build the prices map
        results.forEach(result => {
            if (result.price !== null) {
                prices.set(result.typeId, result.price);
            }
        });
        
        console.log(`Successfully fetched prices for ${prices.size} out of ${typeIds.length} items`);
        
    } catch (error) {
        console.error('Error in getPrices:', error);
        
        // If ESI is completely unavailable, fallback to Fuzzwork as backup
        console.log('ESI unavailable, attempting Fuzzwork fallback...');
        return await getFuzzworkPrices(typeIds);
    }
    
    return prices;
}

/**
 * Fallback function to get prices from Fuzzwork API
 * @param {number[]} typeIds - Array of type IDs to get prices for
 * @returns {Promise<Map<number, number>>} - Map of type IDs to prices
 */
async function getFuzzworkPrices(typeIds) {
    const prices = new Map();
    
    try {
        // Use the aggregated pricing API as fallback
        const typeIdList = typeIds.join(',');
        const response = await fetch(`${FUZZWORK_API_BASE}aggregates?types=${typeIdList}`);
        
        if (!response.ok) {
            console.error(`Failed to get fallback prices: ${response.status}`);
            return prices;
        }
        
        const data = await response.json();
        
        // Extract prices from the aggregated data
        for (const [typeId, priceData] of Object.entries(data)) {
            if (priceData && priceData.sell && priceData.sell.min) {
                prices.set(parseInt(typeId, 10), priceData.sell.min);
            }
        }
        
        console.log(`Fallback: Successfully fetched ${prices.size} prices from Fuzzwork`);
        
    } catch (error) {
        console.error('Error in getFuzzworkPrices fallback:', error);
    }
    
    return prices;
}

/**
 * Calculate total value of a ship fitting
 * @param {Map<string, number>} items - Map of item names to quantities
 * @returns {Promise<number>} - Total ISK value
 */
async function calculateShipValue(items) {
    if (!items || items.size === 0) {
        return 0;
    }

    try {
        console.log('Calculating ship value for', items.size, 'items');
        
        // Convert item names to type IDs
        const itemNames = Array.from(items.keys());
        const typeIds = await getTypeIds(itemNames);
        
        console.log(`Found type IDs for ${typeIds.size} out of ${itemNames.length} items`);
        
        if (typeIds.size === 0) {
            console.warn('No type IDs found for any items - API may be unavailable');
            return 0;
        }
        
        // Get prices for all type IDs
        const typeIdArray = Array.from(typeIds.values());
        const prices = await getPrices(typeIdArray);
        
        console.log(`Found prices for ${prices.size} out of ${typeIdArray.length} type IDs`);
        
        // Calculate total value
        let totalValue = 0;
        let successfullyPriced = 0;
        
        for (const [itemName, quantity] of items) {
            const typeId = typeIds.get(itemName);
            if (typeId) {
                const price = prices.get(typeId);
                if (price) {
                    totalValue += price * quantity;
                    successfullyPriced++;
                    console.log(`${itemName} (${quantity}x): ${price.toLocaleString()} ISK each`);
                } else {
                    console.warn(`No price found for ${itemName} (typeId: ${typeId})`);
                }
            } else {
                console.warn(`No type ID found for ${itemName}`);
            }
        }
        
        console.log(`Successfully priced ${successfullyPriced} out of ${items.size} items`);
        console.log(`Total ship value: ${totalValue.toLocaleString()} ISK`);
        
        return totalValue;
        
    } catch (error) {
        console.error('Error calculating ship value:', error);
        
        // Return 0 if calculation fails
        console.log('Ship value calculation failed - returning 0');
        return 0;
    }
}

/**
 * Check if the ESI API is available
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function isApiAvailable() {
    try {
        // Check ESI status endpoint
        const response = await fetch(`${ESI_BASE_URL}/status/`, {
            method: 'GET',
            mode: 'cors'
        });
        return response.ok;
    } catch (error) {
        console.warn('ESI API health check failed:', error);
        
        // Fallback to check Fuzzwork API
        try {
            const fallbackResponse = await fetch(`${FUZZWORK_API_BASE}search?q=test`, {
                method: 'HEAD',
                mode: 'cors'
            });
            return fallbackResponse.ok;
        } catch (fallbackError) {
            console.warn('Fuzzwork API health check also failed:', fallbackError);
            return false;
        }
    }
}