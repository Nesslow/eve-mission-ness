// External API call logic (Fuzzwork, ESI)
console.log("api.js loaded");

// Fuzzwork API endpoints
const FUZZWORK_API_BASE = 'https://market.fuzzwork.co.uk/api/';

// ESI API endpoints and constants
const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const THE_FORGE_REGION_ID = 10000002;
const JITA_4_4_STATION_ID = 60003760;

/**
 * Convert item names to type IDs using multiple fallback methods
 * @param {string[]} itemNames - Array of item names to lookup
 * @returns {Promise<Map<string, number>>} - Map of item names to type IDs
 */
async function getTypeIds(itemNames) {
    if (!itemNames || itemNames.length === 0) {
        return new Map();
    }

    const typeIds = new Map();
    
    // Common items cache for faster lookup (from backup file)
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
        'small shield booster i': 3831,
        'salvager i': 25861,
        'mobile tractor unit': 24348,
        'afterburner i': 438,
        'cormorant': 601,
        'small shield booster i': 3831
    };
    
    try {
        const promises = itemNames.map(async (itemName) => {
            try {
                console.log(`Looking up type ID for: ${itemName}`);
                const normalizedName = itemName.toLowerCase().trim();
                
                // Check common items cache first
                if (commonItems[normalizedName]) {
                    console.log(`Found ${itemName} in common items cache: ${commonItems[normalizedName]}`);
                    return { name: itemName, typeId: commonItems[normalizedName] };
                }
                
                // Try direct Fuzzwork lookup (more reliable than ESI search)
                return await getFuzzworkTypeId(itemName);
                
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
 * Fallback function to get type ID from Fuzzwork API
 * @param {string} itemName - Item name to search for
 * @returns {Promise<Object|null>} - Result object or null
 */
async function getFuzzworkTypeId(itemName) {
    try {
        console.log(`Trying Fuzzwork lookup for: ${itemName}`);
        
        // Apply rate limiting
        await rateLimitedFetch();
        
        // Use the correct Fuzzwork API endpoint from backup
        const response = await fetch(`https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(itemName)}`);
        
        if (!response.ok) {
            console.warn(`Fuzzwork lookup failed for ${itemName}: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        
        let typeId = null;
        
        // Handle API response format (from backup)
        if (Array.isArray(data)) {
            typeId = data.length > 0 ? data[0].typeID : null;
        } else if (data.typeID) {
            typeId = data.typeID;
        }
        
        if (typeId && typeId > 0) {
            console.log(`Fuzzwork found type ID ${typeId} for ${itemName}`);
            return { name: itemName, typeId: typeId };
        }
        
        console.warn(`Fuzzwork: No type ID found for ${itemName}`);
        return null;
        
    } catch (error) {
        console.error(`Fuzzwork lookup error for ${itemName}:`, error);
        return null;
    }
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
        console.log(`Fetching prices for ${typeIds.length} items`);
        
        // Process each type ID individually to get accurate Jita pricing
        const pricePromises = typeIds.map(async (typeId) => {
            try {
                console.log(`Fetching market data for type ID: ${typeId}`);
                
                // Step 1: Fetch all sell orders from The Forge region
                const response = await fetch(`${ESI_BASE_URL}/markets/${THE_FORGE_REGION_ID}/orders?type_id=${typeId}&order_type=sell`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn(`No market data found for type ID ${typeId} (item may not be tradeable)`);
                        return { typeId, price: null };
                    }
                    console.warn(`Failed to get market data for type ID ${typeId}: ${response.status}`);
                    return { typeId, price: null };
                }
                
                const allOrders = await response.json();
                
                if (!Array.isArray(allOrders) || allOrders.length === 0) {
                    console.warn(`No sell orders found for type ID ${typeId}`);
                    return { typeId, price: null };
                }
                
                // Step 2: Filter orders to include only those at Jita 4-4 station
                const jitaOrders = allOrders.filter(order => 
                    order.location_id === JITA_4_4_STATION_ID && 
                    order.volume_remain > 0
                );
                
                if (jitaOrders.length === 0) {
                    console.warn(`No sell orders found at Jita 4-4 for type ID ${typeId}`);
                    // Fallback to any orders in The Forge region
                    const forgeOrders = allOrders.filter(order => order.volume_remain > 0);
                    if (forgeOrders.length > 0) {
                        forgeOrders.sort((a, b) => a.price - b.price);
                        const fallbackPrice = forgeOrders[0].price;
                        console.log(`Type ID ${typeId}: Using fallback price ${fallbackPrice} ISK from The Forge region`);
                        return { typeId, price: fallbackPrice };
                    }
                    return { typeId, price: null };
                }
                
                // Step 3: Sort filtered orders by price in ascending order
                jitaOrders.sort((a, b) => a.price - b.price);
                
                // Step 4: Calculate top 5% (minimum 1 order)
                const top5Count = Math.max(1, Math.ceil(jitaOrders.length * 0.05));
                const top5Orders = jitaOrders.slice(0, top5Count);
                
                // Step 5: Calculate average price of top 5% orders
                const totalPrice = top5Orders.reduce((sum, order) => sum + order.price, 0);
                const averagePrice = totalPrice / top5Orders.length;
                
                const finalPrice = Math.round(averagePrice * 100) / 100; // Round to 2 decimal places
                console.log(`Type ID ${typeId}: Top 5% average price ${finalPrice} ISK from ${top5Orders.length} orders`);
                
                return { typeId, price: finalPrice };
                
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
        
        // If ESI is completely unavailable, fallback to Fuzzwork
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
        console.log(`Fetching fallback prices from Fuzzwork for ${typeIds.length} items`);
        
        // Process each type ID individually for better error handling
        for (const typeId of typeIds) {
            try {
                await rateLimitedFetch();
                
                // Use the aggregated pricing API
                const response = await fetch(`https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=${typeId}`);
                
                if (!response.ok) {
                    console.warn(`Failed to get fallback price for type ID ${typeId}: ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                
                // Extract price from the aggregated data
                if (data[typeId] && data[typeId].sell && data[typeId].sell.min) {
                    const price = data[typeId].sell.min;
                    prices.set(typeId, price);
                    console.log(`Fuzzwork fallback - Type ID ${typeId}: ${price} ISK`);
                }
                
            } catch (error) {
                console.error(`Error fetching fallback price for type ID ${typeId}:`, error);
                continue;
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
 * Enhanced calculateShipValue function with better error handling
 * @param {Map<string, number>} items - Map of item names to quantities
 * @returns {Promise<Object>} - Object with value and item details
 */
async function calculateShipValueDetailed(items) {
    if (!items || items.size === 0) {
        return { totalValue: 0, items: [], success: true };
    }

    try {
        console.log('Calculating detailed ship value for', items.size, 'items');
        
        const itemDetails = [];
        let totalValue = 0;
        let successCount = 0;
        
        // Convert to array for batch processing
        const itemArray = Array.from(items.entries()).map(([name, quantity]) => ({
            name,
            quantity
        }));
        
        // Get type IDs for all items
        const itemNames = itemArray.map(item => item.name);
        const typeIds = await getTypeIds(itemNames);
        
        console.log(`Found type IDs for ${typeIds.size} out of ${itemNames.length} items`);
        
        if (typeIds.size === 0) {
            console.warn('No type IDs found for any items');
            return { totalValue: 0, items: [], success: false, error: 'No type IDs found' };
        }
        
        // Get prices for all type IDs
        const typeIdArray = Array.from(typeIds.values());
        const prices = await getPrices(typeIdArray);
        
        console.log(`Found prices for ${prices.size} out of ${typeIdArray.length} type IDs`);
        
        // Process each item
        for (const item of itemArray) {
            const typeId = typeIds.get(item.name);
            const price = typeId ? prices.get(typeId) : null;
            
            const itemDetail = {
                name: item.name,
                quantity: item.quantity,
                typeId: typeId,
                unitPrice: price,
                totalPrice: price ? price * item.quantity : 0,
                success: !!price
            };
            
            itemDetails.push(itemDetail);
            
            if (price) {
                totalValue += itemDetail.totalPrice;
                successCount++;
                console.log(`${item.name} (${item.quantity}x): ${price.toLocaleString()} ISK each`);
            } else {
                console.warn(`No price found for ${item.name}${typeId ? ` (typeId: ${typeId})` : ''}`);
            }
        }
        
        console.log(`Successfully priced ${successCount} out of ${items.size} items`);
        console.log(`Total ship value: ${totalValue.toLocaleString()} ISK`);
        
        return {
            totalValue,
            items: itemDetails,
            success: true,
            successCount,
            totalItems: items.size
        };
        
    } catch (error) {
        console.error('Error calculating detailed ship value:', error);
        return {
            totalValue: 0,
            items: [],
            success: false,
            error: error.message
        };
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
        
        if (response.ok) {
            console.log('ESI API is available');
            return true;
        }
        
        console.warn('ESI API returned non-OK status:', response.status);
        
    } catch (error) {
        console.warn('ESI API health check failed:', error);
    }
    
    // Fallback to check Fuzzwork API
    try {
        console.log('Checking Fuzzwork API availability...');
        const fallbackResponse = await fetch(`${FUZZWORK_API_BASE}typeID.php?typename=Tritanium`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (fallbackResponse.ok) {
            console.log('Fuzzwork API is available');
            return true;
        }
        
        console.warn('Fuzzwork API also returned non-OK status:', fallbackResponse.status);
        
    } catch (fallbackError) {
        console.warn('Fuzzwork API health check also failed:', fallbackError);
    }
    
    console.error('Both ESI and Fuzzwork APIs are unavailable');
    return false;
}

// Rate limiting for API calls
let lastApiCall = 0;
const MIN_API_INTERVAL = 100; // 100ms between API calls

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