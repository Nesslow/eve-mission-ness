/**
 * Inventory Parser for EVE Mission Tracker
 * Parses EVE Online inventory clipboard data
 */

const InventoryParser = (() => {
  /**
   * Parse EVE inventory clipboard data
   * Format is typically:
   * Item Name\tQuantity\t(optional estimated price)
   */
  async function parse(text) {
    if (!text) return [];

    const items = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        const item = parseLine(line);
        if (item) {
          items.push(item);
        }
      } catch (error) {
        console.warn(`Failed to parse inventory line: ${line}`, error);
      }
    }

    // Batch price lookup using EVEpraisal if available
    if (typeof MarketAPI !== 'undefined' && items.length > 0) {
      try {
        const priceMap = await MarketAPI.getBatchItemPrices(items);
        items.forEach(item => {
          if (priceMap[item.name]) {
            item.marketPrice = priceMap[item.name];
            item.totalValue = item.marketPrice * item.quantity;
            // Update the UI for this item if it is displayed
            const valueElem = document.querySelector(`.inventory-value[data-item-id="${item.id}"]`);
            if (valueElem) {
              valueElem.textContent = UIController.formatISK(item.totalValue);
            }
          }
        });
        UIController.updateInventoryTotal();
      } catch (error) {
        console.warn('Batch price lookup failed:', error);
      }
    }

    return items;
  }

  /**
   * Parse a single inventory line
   */
  function parseLine(line) {
    // Split by tabs
    const parts = line.split('\t');
    
    // Need at least name and quantity
    if (parts.length < 2) return null;
    
    const name = parts[0].trim();
    let quantity = parseInt(parts[1].replace(/,/g, '')) || 1;
    
    // Check if quantity is actually name of stat and item name is combined with quantity
    if (isNaN(quantity) && name.includes(' x')) {
      const nameParts = name.split(' x');
      if (nameParts.length === 2) {
        const parsedQuantity = parseInt(nameParts[1]);
        if (!isNaN(parsedQuantity)) {
          quantity = parsedQuantity;
        }
      }
    }
    
    // Try to extract estimated value
    let estimatedValue = 0;
    if (parts.length > 2) {
      // Look for a part that contains ISK
      for (let i = 2; i < parts.length; i++) {
        if (parts[i].includes('ISK')) {
          estimatedValue = parseIskValue(parts[i]);
          break;
        }
      }
    }
    
    // Create item object
    const item = {
      id: `item-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      quantity: quantity,
      estimatedValue: estimatedValue,
      totalValue: estimatedValue * quantity,
      marketPrice: 0 // Will be filled in later by market API
    };
    
    // If we have a market API, try to get the price
    if (typeof MarketAPI !== 'undefined') {
      MarketAPI.getItemPrice(name)
        .then(price => {
          console.debug(`[InventoryParser] Market price for ${name}:`, price);
          if (price) {
            item.marketPrice = price;
            item.totalValue = price * quantity;

            // Update the UI for this item if it is displayed
            const valueElem = document.querySelector(`.inventory-value[data-item-id="${item.id}"]`);
            if (valueElem) {
              valueElem.textContent = UIController.formatISK(item.totalValue);
            }
            // Update total value
            UIController.updateInventoryTotal();
          }
        })
        .catch(error => {
          console.warn(`Could not get market price for ${name}:`, error);
        });
    }
    
    return item;
  }

  /**
   * Parse ISK value from string
   */
  function parseIskValue(iskStr) {
    if (!iskStr) return 0;
    
    // Remove 'ISK' and commas, then parse
    const cleanValue = iskStr.replace(/ISK|,|\s/g, '');
    return parseFloat(cleanValue) || 0;
  }

  // Public API
  return {
    parse
  };
})();