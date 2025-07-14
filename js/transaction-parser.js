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
          console.debug(`[TransactionParser] Parsed line:`, line, transaction);
        } else {
          console.debug(`[TransactionParser] No match for line:`, line);
        }
      } catch (error) {
        console.warn(`Failed to parse transaction line: ${line}`, error);
      }
    }

    console.debug(`[TransactionParser] Total parsed transactions:`, transactions.length);
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

    // Format 1: Tab or multiple space separated (robust)
    // Date    Type    Amount    Balance    Description
    // Example: 2025.07.13 18:22    Bounty Prizes    4.467.189 ISK    2.831.882.774 ISK    [r] ...
    const pattern1 = /^(\d{4}[.\/-]\d{2}[.\/-]\d{2}(?:[ ]+\d{2}:\d{2})?)[ \t]+([^\t]+)[ \t]+([\d.,]+) ISK[ \t]+([\d.,]+) ISK[ \t]+(.+)$/;

    // Format 2: Tab or multiple space separated (legacy, no time)
    // Date    Amount    From/To    Description
    const pattern2 = /(\d{4}[-\./]\d{2}[-\./]\d{2})(?:[ \t]+)([\d,\.]+)(?:[ \t]+)([^\t]+)(?:[ \t]+)(.+)/;

    // Format 3: Comma separated
    // Date, Amount, From/To, Description
    const pattern3 = /(\d{4}[-\./]\d{2}[-\./]\d{2}),\s*([\d,\.]+),\s*([^,]+),\s*(.+)/;

    let match = line.match(pattern1);
    if (match) {
      // Newer EVE format with time, type, amount, balance, description
      const dateStr = match[1];
      const typeStr = match[2].trim();
      const amountStr = match[3];
      // const balanceStr = match[4]; // Not used
      const description = match[5].trim();

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      const type = determineTransactionType(description, typeStr);
      const isIncome = determineIsIncome(description, typeStr);

      return {
        id: `tx-${date}-${Math.random().toString(36).substr(2, 9)}`,
        date: date,
        amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
        description: description,
        fromTo: typeStr,
        type: type,
        isSelected: shouldAutoSelect(type, description)
      };
    }

    // Try legacy pattern2
    match = line.match(pattern2);
    if (match) {
      const dateStr = match[1];
      const amountStr = match[2];
      const fromTo = match[3].trim();
      const description = match[4].trim();

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      const type = determineTransactionType(description, fromTo);
      const isIncome = determineIsIncome(description, fromTo);

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

    // Try comma separated
    match = line.match(pattern3);
    if (match) {
      const dateStr = match[1];
      const amountStr = match[2];
      const fromTo = match[3].trim();
      const description = match[4].trim();

      const date = parseDate(dateStr);
      const amount = parseAmount(amountStr);
      const type = determineTransactionType(description, fromTo);
      const isIncome = determineIsIncome(description, fromTo);

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

    // No match
    return null;
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
    // Remove commas, periods (as thousands separators), and spaces
    // If there is a decimal part, keep only the last period as decimal separator
    let cleanAmount = amountStr.replace(/\s/g, '');
    // If there is a comma, treat it as decimal separator (EU format)
    if (cleanAmount.includes(',')) {
      cleanAmount = cleanAmount.replace(/\./g, ''); // Remove all periods (thousands)
      cleanAmount = cleanAmount.replace(/,/g, '.'); // Replace decimal comma with period
    } else {
      // No comma, so remove all periods (thousands separators)
      cleanAmount = cleanAmount.replace(/\./g, '');
    }
    cleanAmount = cleanAmount.replace(/,/g, ''); // Remove any stray commas
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