// External API call logic (Fuzzwork, ESI)
console.log("api.js loaded");

// Fuzzwork API endpoints
const FUZZWORK_API_BASE = 'https://market.fuzzwork.co.uk/api/';

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
 * Get market prices for type IDs using Fuzzwork API
 * @param {number[]} typeIds - Array of type IDs to get prices for
 * @returns {Promise<Map<number, number>>} - Map of type IDs to prices
 */
async function getPrices(typeIds) {
    if (!typeIds || typeIds.length === 0) {
        return new Map();
    }

    const prices = new Map();
    
    try {
        // Use the aggregated pricing API
        const typeIdList = typeIds.join(',');
        const response = await fetch(`${FUZZWORK_API_BASE}aggregates?types=${typeIdList}`);
        
        if (!response.ok) {
            console.error(`Failed to get prices: ${response.status}`);
            return prices;
        }
        
        const data = await response.json();
        
        // Extract prices from the aggregated data
        for (const [typeId, priceData] of Object.entries(data)) {
            if (priceData && priceData.sell && priceData.sell.min) {
                prices.set(parseInt(typeId, 10), priceData.sell.min);
            }
        }
        
    } catch (error) {
        console.error('Error in getPrices:', error);
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
        // Convert item names to type IDs
        const itemNames = Array.from(items.keys());
        const typeIds = await getTypeIds(itemNames);
        
        // Get prices for all type IDs
        const typeIdArray = Array.from(typeIds.values());
        const prices = await getPrices(typeIdArray);
        
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
        return totalValue;
        
    } catch (error) {
        console.error('Error calculating ship value:', error);
        
        // Return a fallback value or 0 if API is completely unavailable
        console.log('API unavailable - ship value calculation failed');
        return 0;
    }
}

/**
 * Check if the API is available
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function isApiAvailable() {
    try {
        const response = await fetch(`${FUZZWORK_API_BASE}search?q=test`, {
            method: 'HEAD',
            mode: 'cors'
        });
        return response.ok;
    } catch (error) {
        console.warn('API health check failed:', error);
        return false;
    }
}