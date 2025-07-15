// Parsing logic for in-game data
console.log("parser.js loaded");

/**
 * Parse raw fitting text into ship type and item quantities
 * @param {string} fittingText - Raw fitting text from the game
 * @returns {Object} - { shipType: string, items: Map<string, number> }
 */
function parseFitting(fittingText) {
    if (!fittingText || typeof fittingText !== 'string') {
        return { shipType: '', items: new Map() };
    }

    const lines = fittingText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
        return { shipType: '', items: new Map() };
    }

    // Extract ship type from the first line: [ShipType, FittingName]
    const shipType = extractShipType(lines[0]);
    
    // Parse items from remaining lines
    const items = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const { itemName, quantity } = parseItemLine(line);
        
        if (itemName) {
            // If item already exists, add to quantity
            const currentQuantity = items.get(itemName) || 0;
            items.set(itemName, currentQuantity + quantity);
        }
    }
    
    // Add the ship hull itself with quantity 1
    if (shipType) {
        items.set(shipType, 1);
    }
    
    return { shipType, items };
}

/**
 * Extract ship type from fitting header line
 * @param {string} headerLine - First line of fitting like "[Cormorant, thewife]"
 * @returns {string} - Ship type name
 */
function extractShipType(headerLine) {
    const match = headerLine.match(/^\[([^,]+),/);
    return match ? match[1].trim() : '';
}

/**
 * Parse an individual item line to extract name and quantity
 * @param {string} line - Item line like "Salvager I" or "Mobile Tractor Unit x1"
 * @returns {Object} - { itemName: string, quantity: number }
 */
function parseItemLine(line) {
    // Handle explicit quantity format like "Mobile Tractor Unit x1"
    const explicitQuantityMatch = line.match(/^(.+?)\s+x(\d+)$/);
    if (explicitQuantityMatch) {
        return {
            itemName: explicitQuantityMatch[1].trim(),
            quantity: parseInt(explicitQuantityMatch[2], 10)
        };
    }
    
    // Handle implicit quantity (single item per line)
    return {
        itemName: line.trim(),
        quantity: 1
    };
}