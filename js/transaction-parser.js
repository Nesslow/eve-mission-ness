/**
 * Transaction Parser for EVE Mission Tracker
 * Parses EVE Online wallet transaction logs
 */

const TransactionParser = (() => {
  /**
   * Parse EVE transaction log
   * Format varies but typically follows:
   * Date        | Amount     | Type        | Description
   * 2025.07.13  | 10,000.00  | bounty      | Bounty Prize for killing...
   */
  function parse(text) {
    if (!text) return [];
    
    const transactions = [];
    const lines = text.split('\n');
    
    // Skip header lines if they exist (check if first line is header)
    const startLine = isHeaderLine(lines[0]) ? 1 : 0;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      try {
        const transaction = parseLine(line);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Failed to parse transaction line: ${line}`, error);
      }
    }
    
    return transactions;
  }

  /**
   * Check if a line is a header line
   */
  function isHeaderLine(line) {
    if (!line) return false;
    
    const headerKeywords = ['date', 'amount', 'type', 'description', 'transaction'];
    const lowercaseLine = line.toLowerCase();
    
    // If the line contains at least 2 header keywords, consider it a header
    return headerKeywords.filter(keyword => lowercaseLine.includes(keyword)).length >= 2;
  }

  /**
   * Parse a single transaction line
   * Supports multiple EVE log formats
   */
  function parseLine(line) {
    // Try different formats
    
    // Format 1: Tab or multiple space separated
    // Date    Amount    From/To    Description
    const pattern1 = /(\d{4}[-\.\/]\d{2}[-\.\/]\d{2})(?:[ \t]+)([\d,\.]+)(?:[ \t]+)([^\t]+)(?:[ \t]+)(.+)/;
    
    // Format 2: Comma separated
    // Date, Amount, From/To, Description
    const pattern2 = /(\d{4}[-\.\/]\d{2}[-\.\/]\d{2}),\s*([\d,\.]+),\s*([^,]+),\s*(.+)/;
    
    let match = line.match(pattern1) || line.match(pattern2);
    
    if (!match) return null;
    
    // Extract values
    const dateStr = match[1];
    const amountStr = match[2];
    const fromTo = match[3].trim();
    const description = match[4].trim();
    
    // Parse date to YYYY-MM-DD format
    const date = parseDate(dateStr);
    
    // Parse amount (remove commas and convert to number)
    const amount = parseAmount(amountStr);
    
    // Determine transaction type
    const type = determineTransactionType(description, fromTo);
    
    // Determine if income (positive) or expense (negative)
    const isIncome = determineIsIncome(description, fromTo);
    
    // Create transaction object
    return {
      id: `tx-${date}-${Math.random().toString(36).substr(2, 9)}`,
      date: date,
      amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
      description: description,
      fromTo: fromTo,
      type: type,
      isSelected: shouldAutoSelect(type, description)
    };
  }

  /**
   * Parse date string to YYYY-MM-DD format
   */
  function parseDate(dateStr) {
    // Support various date formats: YYYY.MM.DD, YYYY/MM/DD, YYYY-MM-DD
    const parts = dateStr.split(/[\.\/\-]/);
    if (parts.length !== 3) {
      return new Date().toISOString().split('T')[0]; // Fallback to today
    }
    
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse amount string to number
   */
  function parseAmount(amountStr) {
    // Remove commas and spaces
    const cleanAmount = amountStr.replace(/,|\s/g, '');
    return parseFloat(cleanAmount) || 0;
  }

  /**
   * Determine transaction type based on description and from/to
   */
  function determineTransactionType(description, fromTo) {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('bounty')) {
      return 'bounty';
    } else if (lowerDesc.includes('mission') || lowerDesc.includes('agent') || lowerDesc.includes('reward')) {
      return 'mission';
    } else if (lowerDesc.includes('market') || lowerDesc.includes('transaction') || lowerDesc.includes('sell') || lowerDesc.includes('buy')) {
      return 'market';
    } else if (lowerDesc.includes('insurance')) {
      return 'insurance';
    } else {
      return 'other';
    }
  }

  /**
   * Determine if the transaction is income or expense
   */
  function determineIsIncome(description, fromTo) {
    const lowerDesc = description.toLowerCase();
    
    // Most mission-related transactions are income
    if (lowerDesc.includes('mission') || 
        lowerDesc.includes('agent') || 
        lowerDesc.includes('bounty') || 
        lowerDesc.includes('reward')) {
      return true;
    }
    
    // Check for common expense keywords
    if (lowerDesc.includes('purchased') || 
        lowerDesc.includes('buy') ||
        lowerDesc.includes('fee') ||
        lowerDesc.includes('tax')) {
      return false;
    }
    
    // Default to income
    return true;
  }

  /**
   * Determine if a transaction should be auto-selected based on type and description
   */
  function shouldAutoSelect(type, description) {
    const lowerDesc = description.toLowerCase();
    
    // Auto-select all bounty payments
    if (type === 'bounty') {
      return true;
    }
    
    // Auto-select mission rewards
    if (type === 'mission') {
      return true;
    }
    
    return false;
  }

  // Public API
  return {
    parse
  };
})();