/**
 * UI Controller for EVE Mission Tracker
 * Manages UI interactions and updates
 */

const UIController = (() => {
  /**
   * Initialize UI components
   */
  function init() {
    // Set default tab
    showTab('dashboard');
    
    // Load settings
    loadSettings();
    
    console.log('UI initialized');
  }

  /**
   * Show a specific tab
   */
  function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(button => {
      button.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
    
    // Activate selected tab button
    const selectedButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (selectedButton) {
      selectedButton.classList.add('active');
    }
  }

  /**
   * Show a modal
   */
  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  /**
   * Hide a modal
   */
  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Show a notification
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger reflow to ensure transition works
    notification.offsetHeight;
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Show an error message
   */
  function showError(message) {
    showNotification(message, 'error');
  }

  /**
   * Show a success message
   */
  function showSuccess(message) {
    showNotification(message, 'success');
  }

  /**
   * Show a warning message
   */
  function showWarning(message) {
    showNotification(message, 'warning');
  }

  /**
   * Show an info message
   */
  function showInfo(message) {
    showNotification(message, 'info');
  }

  /**
   * Update the active mission UI
   */
  function updateActiveMissionUI(mission) {
    const activeMissionInfo = document.getElementById('active-mission-info');
    const missionTimer = document.getElementById('mission-timer');
    const startButton = document.getElementById('start-mission-btn');
    const endButton = document.getElementById('end-mission-btn');
    
    if (!mission) {
      // No active mission
      activeMissionInfo.innerHTML = '<p class="no-mission">No active mission</p>';
      missionTimer.classList.add('hidden');
      startButton.classList.remove('hidden');
      endButton.classList.add('hidden');
    } else {
      // Active mission
      activeMissionInfo.innerHTML = `
        <p><strong>${mission.missionName}</strong></p>
        <p>Level: ${mission.missionLevel}</p>
        ${mission.location ? `<p>Location: ${mission.location}</p>` : ''}
      `;
      missionTimer.classList.remove('hidden');
      startButton.classList.add('hidden');
      endButton.classList.remove('hidden');
    }
  }

  /**
   * Display parsed transactions
   */
  function displayParsedTransactions(transactions) {
    const parsedTransactions = document.getElementById('parsed-transactions');
    const transactionList = document.getElementById('transaction-list');
    
    if (!transactions || transactions.length === 0) {
      parsedTransactions.classList.add('hidden');
      return;
    }
    
    // Show the container
    parsedTransactions.classList.remove('hidden');
    
    // Clear previous list
    transactionList.innerHTML = '';
    
    // Add each transaction
    transactions.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'transaction-item';
      
      const amountClass = tx.amount >= 0 ? 'positive' : 'negative';
      
      item.innerHTML = `
        <input type="checkbox" data-transaction-id="${tx.id}" ${tx.isSelected ? 'checked' : ''}>
        <div class="transaction-info">
          <div>${tx.description}</div>
          <div class="transaction-details">${tx.date} - ${tx.type}</div>
        </div>
        <div class="transaction-amount ${amountClass}">${formatISK(tx.amount)}</div>
      `;
      
      transactionList.appendChild(item);
    });
    
    // Add event listeners to checkboxes
    transactionList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Update selected transactions
        const selectedTransactions = transactions.filter((tx, index) => {
          return transactionList.querySelectorAll('input[type="checkbox"]')[index].checked;
        });
        
        // Store selected transactions
        MissionTracker.setSelectedTransactions(selectedTransactions);
      });
    });
    
    // Set initial selected transactions
    const selectedTransactions = transactions.filter((tx, index) => {
      return transactionList.querySelectorAll('input[type="checkbox"]')[index].checked;
    });
    
    MissionTracker.setSelectedTransactions(selectedTransactions);
  }

  /**
   * Display parsed inventory
   */
  async function displayParsedInventory(items) {
    const parsedInventory = document.getElementById('parsed-inventory');
    const inventoryList = document.getElementById('inventory-list');
    
    if (!items || items.length === 0) {
      parsedInventory.classList.add('hidden');
      return;
    }
    
    // Show the container
    parsedInventory.classList.remove('hidden');
    
    // Clear previous list
    inventoryList.innerHTML = '';
    
    // Add each item
    items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'inventory-item';
      
      itemElement.innerHTML = `
        <div class="inventory-info">
          <div>${item.name}</div>
          <div class="inventory-quantity">Quantity: ${item.quantity}</div>
        </div>
        <div class="inventory-value" data-item-id="${item.id}">${formatISK(item.totalValue || 0)}</div>
      `;
      
      inventoryList.appendChild(itemElement);
    });
    
    // Update total value
    updateInventoryTotal();
    
    // Store inventory items
    MissionTracker.setInventoryItems(items);
    
    // Fetch market prices using our new MarketAPI
    if (typeof MarketAPI !== 'undefined' && items.length > 0) {
      try {
        showInfo(`Fetching Jita top 5% average prices for ${items.length} items...`);
        
        let pricesUpdated = 0;
        let totalErrors = 0;
        
        // Process items one by one to show progress
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          try {
            // Update progress message
            showInfo(`Fetching prices... ${i + 1}/${items.length} (${item.name})`);
            
            const price = await MarketAPI.getItemPrice(item.name);
            
            if (price && price > 0) {
              // Update item with market price
              item.marketPrice = price;
              item.totalValue = price * item.quantity;
              pricesUpdated++;
              
              // Update the UI for this item
              const valueElem = document.querySelector(`.inventory-value[data-item-id="${item.id}"]`);
              if (valueElem) {
                valueElem.textContent = formatISK(item.totalValue);
                valueElem.style.color = '#2ecc71'; // Success color
              }
            }
            
          } catch (error) {
            console.warn(`Failed to fetch price for ${item.name}:`, error.message);
            totalErrors++;
            
            // Mark failed items in UI
            const valueElem = document.querySelector(`.inventory-value[data-item-id="${item.id}"]`);
            if (valueElem) {
              valueElem.style.color = '#e74c3c'; // Error color
              valueElem.title = `Price lookup failed: ${error.message}`;
            }
          }
        }
        
        // Update total value after all price fetches
        updateInventoryTotal();
        
        // Show final result
        if (pricesUpdated > 0) {
          const successRate = Math.round((pricesUpdated / items.length) * 100);
          showSuccess(`✅ Jita market prices updated for ${pricesUpdated}/${items.length} items (${successRate}% success rate)`);
        } else {
          showWarning('⚠️ No market prices found. Check item names and try again.');
        }
        
        if (totalErrors > 0) {
          showInfo(`ℹ️ ${totalErrors} items failed price lookup - hover over red prices for details`);
        }
        
      } catch (error) {
        console.error('Market price batch fetch failed:', error);
        showError('❌ Failed to fetch market prices. Please try again.');
      }
    }
  }

  /**
   * Update inventory total value
   */
  function updateInventoryTotal() {
    const inventoryTotalValue = document.getElementById('inventory-total-value');
    
    // Calculate total value from stored items
    let total = 0;
    const inventoryElements = document.querySelectorAll('.inventory-value');
    
    inventoryElements.forEach(element => {
      const valueText = element.textContent;
      const value = parseISKValue(valueText);
      total += value;
    });
    
    inventoryTotalValue.textContent = formatISK(total);
  }

  /**
   * Parse ISK value from formatted string
   */
  function parseISKValue(iskString) {
    if (!iskString) return 0;
    
    // Remove 'ISK', 'B', 'M', 'K' and commas
    let cleanValue = iskString.replace(/ISK|,|\s/g, '');
    
    // Handle abbreviations
    if (cleanValue.includes('B')) {
      cleanValue = parseFloat(cleanValue.replace('B', '')) * 1000000000;
    } else if (cleanValue.includes('M')) {
      cleanValue = parseFloat(cleanValue.replace('M', '')) * 1000000;
    } else if (cleanValue.includes('K')) {
      cleanValue = parseFloat(cleanValue.replace('K', '')) * 1000;
    } else {
      cleanValue = parseFloat(cleanValue);
    }
    
    return cleanValue || 0;
  }

  /**
   * Format ISK value for display
   */
  function formatISK(value) {
    if (typeof value !== 'number') {
      return '0 ISK';
    }
    
    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(2) + ' B ISK';
    } else if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + ' M ISK';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(2) + ' K ISK';
    } else {
      return value.toFixed(0) + ' ISK';
    }
  }

  /**
   * Go to a specific step in the mission completion process
   */
  function goToMissionStep(stepNumber) {
    // Update steps indicator
    document.querySelectorAll('.step').forEach(step => {
      const stepNum = parseInt(step.getAttribute('data-step'));
      
      if (stepNum < stepNumber) {
        step.classList.add('completed');
        step.classList.remove('active');
      } else if (stepNum === stepNumber) {
        step.classList.add('active');
        step.classList.remove('completed');
      } else {
        step.classList.remove('active', 'completed');
      }
    });
    
    // Hide all step content
    document.querySelectorAll('.step-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Show current step content
    const currentContent = document.getElementById(`step-${stepNumber}-content`);
    if (currentContent) {
      currentContent.classList.add('active');
    }
  }

  /**
   * Reset the mission completion steps
   */
  function resetCompleteMissionSteps() {
    // Reset to step 1
    goToMissionStep(1);
    
    // Clear form inputs
    document.getElementById('transaction-paste').value = '';
    document.getElementById('inventory-paste').value = '';
    document.getElementById('final-notes').value = '';
    
    // Hide parsed data
    document.getElementById('parsed-transactions').classList.add('hidden');
    document.getElementById('parsed-inventory').classList.add('hidden');
    
    // Reset transaction and inventory data
    MissionTracker.setSelectedTransactions([]);
    MissionTracker.setInventoryItems([]);
    
    // Set default expenses from settings
    loadDefaultExpenses();
  }

  /**
   * Update the mission summary
   */
  async function updateMissionSummary() {
    const activeMission = await MissionTracker.getActiveMission();
    if (!activeMission) return;
    
    // Get current duration
    const duration = MissionTracker.getCurrentDuration();
    document.getElementById('summary-duration').textContent = 
      `${duration.hours.toString().padStart(2, '0')}:${duration.minutes.toString().padStart(2, '0')}:${duration.seconds.toString().padStart(2, '0')}`;
    
    // Mission times
    document.getElementById('summary-start-time').textContent = activeMission.startTime || '--:--:--';
    document.getElementById('summary-end-time').textContent = new Date().toTimeString().split(' ')[0];
    
    // Transaction totals
    const transactionData = getSelectedTransactions();
    document.getElementById('summary-bounties').textContent = formatISK(transactionData.bounties);
    document.getElementById('summary-reward').textContent = formatISK(transactionData.missionReward);
    document.getElementById('summary-bonus').textContent = formatISK(transactionData.timeBonus);
    
    // Inventory value
    const inventoryValue = getInventoryValue();
    document.getElementById('summary-loot').textContent = formatISK(inventoryValue);
    
    // Total income
    const totalIncome = transactionData.bounties + transactionData.missionReward + 
                        transactionData.timeBonus + inventoryValue;
    document.getElementById('summary-total-income').textContent = formatISK(totalIncome);
    
    // Update expense totals
    updateExpensesTotal();
    
    // Calculate profit and ISK/hr
    updateProfitAndIskHr();
  }

  /**
   * Get selected transactions totals
   */
  function getSelectedTransactions() {
    const transactionList = document.getElementById('transaction-list');
    if (!transactionList) {
      return { bounties: 0, missionReward: 0, timeBonus: 0 };
    }
    
    // Get all checked transactions
    const checkedTransactions = Array.from(transactionList.querySelectorAll('input[type="checkbox"]:checked'));
    
    let bounties = 0;
    let missionReward = 0;
    let timeBonus = 0;
    
    checkedTransactions.forEach(checkbox => {
      const transactionItem = checkbox.closest('.transaction-item');
      const description = transactionItem.querySelector('.transaction-info div').textContent;
      const amountText = transactionItem.querySelector('.transaction-amount').textContent;
      const amount = parseISKValue(amountText);
      
      if (description.toLowerCase().includes('bounty')) {
        bounties += amount;
      } else if (description.toLowerCase().includes('time bonus')) {
        timeBonus += amount;
      } else if (description.toLowerCase().includes('mission') || description.toLowerCase().includes('agent')) {
        missionReward += amount;
      }
    });
    
    return { bounties, missionReward, timeBonus };
  }

  /**
   * Get inventory total value
   */
  function getInventoryValue() {
    const inventoryTotalValue = document.getElementById('inventory-total-value');
    if (!inventoryTotalValue) return 0;
    
    return parseISKValue(inventoryTotalValue.textContent);
  }

  /**
   * Update expenses total
   */
  function updateExpensesTotal() {
    const ammo = parseInt(document.getElementById('expense-ammo').value) || 0;
    const repairs = parseInt(document.getElementById('expense-repairs').value) || 0;
    const other = parseInt(document.getElementById('expense-other').value) || 0;
    
    const totalExpenses = ammo + repairs + other;
    document.getElementById('summary-total-expenses').textContent = formatISK(totalExpenses);
    
    // Also update profit calculation when expenses change
    updateProfitAndIskHr();
  }

  /**
   * Update profit and ISK/hr calculation
   */
  function updateProfitAndIskHr() {
    // Get income
    const bounties = parseISKValue(document.getElementById('summary-bounties').textContent);
    const missionReward = parseISKValue(document.getElementById('summary-reward').textContent);
    const timeBonus = parseISKValue(document.getElementById('summary-bonus').textContent);
    const lootValue = parseISKValue(document.getElementById('summary-loot').textContent);
    
    const totalIncome = bounties + missionReward + timeBonus + lootValue;
    
    // Get expenses
    const totalExpenses = parseISKValue(document.getElementById('summary-total-expenses').textContent);
    
    // Calculate profit
    const profit = totalIncome - totalExpenses;
    document.getElementById('summary-profit').textContent = formatISK(profit);
    
    // Calculate ISK/hr
    const duration = MissionTracker.getCurrentDuration();
    const totalMinutes = duration.hours * 60 + duration.minutes + (duration.seconds / 60);
    
    let iskPerHour = 0;
    if (totalMinutes > 0) {
      iskPerHour = (profit / totalMinutes) * 60;
    }
    
    document.getElementById('summary-iskhr').textContent = formatISK(iskPerHour) + '/hr';
  }

  /**
   * Show mission suggestions
   */
  function showMissionSuggestions(templates) {
    const suggestionsDiv = document.getElementById('mission-suggestions');
    
    if (!templates || templates.length === 0) {
      suggestionsDiv.classList.add('hidden');
      return;
    }
    
    // Show the suggestions container
    suggestionsDiv.classList.remove('hidden');
    
    // Clear previous suggestions
    suggestionsDiv.innerHTML = '';
    
    // Add each suggestion
    templates.forEach(template => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = `${template.name} (Level ${template.level})`;
      
      // Add click event to select the suggestion
      item.addEventListener('click', () => {
        document.getElementById('mission-name').value = template.name;
        document.getElementById('mission-level').value = template.level;
        
        if (template.agent) {
          document.getElementById('agent-name').value = template.agent;
        }
        
        if (template.location) {
          document.getElementById('location').value = template.location;
        }
        
        if (template.faction) {
          document.getElementById('faction').value = template.faction;
        }
        
        // Check damage type checkboxes
        if (template.damageTypes && Array.isArray(template.damageTypes)) {
          document.querySelectorAll('#damage-types input[type="checkbox"]').forEach(cb => {
            cb.checked = template.damageTypes.includes(cb.value);
          });
        }
        
        // Hide suggestions
        hideMissionSuggestions();
      });
      
      suggestionsDiv.appendChild(item);
    });
  }

  /**
   * Hide mission suggestions
   */
  function hideMissionSuggestions() {
    const suggestionsDiv = document.getElementById('mission-suggestions');
    suggestionsDiv.classList.add('hidden');
  }

  /**
   * Show mission details modal
   */
  function showMissionDetails(mission) {
    // TODO: Implement a modal to show mission details
    // For now, we'll just show an alert with basic info
    
    const income = 
      (mission.income.bounties || 0) + 
      (mission.income.missionReward || 0) + 
      (mission.income.timeBonus || 0) + 
      (mission.income.lootValue || 0);
    
    const expenses = 
      (mission.expenses.ammo || 0) + 
      (mission.expenses.repairs || 0) + 
      (mission.expenses.other || 0);
    
    const profit = income - expenses;
    
    alert(`
      Mission: ${mission.missionName}
      Level: ${mission.missionLevel}
      Date: ${mission.date}
      Duration: ${formatDuration(mission.totalTimeMinutes)}
      
      Income: ${formatISK(income)}
      Expenses: ${formatISK(expenses)}
      Profit: ${formatISK(profit)}
      ISK/hr: ${formatISK(mission.iskPerHour || 0)}/hr
    `);
  }

  /**
   * Load application settings
   */
  async function loadSettings() {
    try {
      // Load refresh prices setting
      const refreshPrices = await missionDB.getSetting('refresh-prices-on-load');
      if (refreshPrices !== null && refreshPrices !== undefined) {
        document.getElementById('refresh-prices').checked = refreshPrices;
      }
      // Load default expenses
      loadDefaultExpenses();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Load default expense values
   */
  async function loadDefaultExpenses() {
    try {
      const defaultExpenses = await missionDB.getSetting('defaultExpenses');
      
      if (defaultExpenses) {
        document.getElementById('default-ammo').value = defaultExpenses.ammo || 50000;
        document.getElementById('default-repairs').value = defaultExpenses.repairs || 10000;
        
        // Also set in the mission completion form
        document.getElementById('expense-ammo').value = defaultExpenses.ammo || 50000;
        document.getElementById('expense-repairs').value = defaultExpenses.repairs || 10000;
      }
    } catch (error) {
      console.error('Error loading default expenses:', error);
    }
  }

  /**
   * Format duration in minutes to hours and minutes
   */
  function formatDuration(minutes) {
    if (!minutes) return '0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  /**
   * Load mission templates
   */
  async function loadTemplates() {
    try {
      const templates = await missionDB.getAllTemplates();
      const templateContainer = document.getElementById('templates-container');
      
      // Clear current templates
      templateContainer.innerHTML = '';
      
      if (!templates || templates.length === 0) {
        templateContainer.innerHTML = '<div class="empty-templates">No templates added yet</div>';
        return;
      }
      
      // Sort templates by name
      templates.sort((a, b) => a.name.localeCompare(b.name));
      
      templates.forEach(template => {
        const templateCard = document.createElement('div');
        templateCard.className = 'template-card';
        
        // Create damage types display
        let damageTypes = '';
        if (template.damageTypes && template.damageTypes.length > 0) {
          damageTypes = `
            <div class="template-section">
              <strong>Damage Types:</strong>
              <div class="template-damage">
                ${template.damageTypes.map(damage => `<span class="damage-type">${damage}</span>`).join('')}
              </div>
            </div>
          `;
        }
        
        // Create enemy weakness display
        let enemyWeakness = '';
        if (template.enemyWeakness && template.enemyWeakness.length > 0) {
          enemyWeakness = `
            <div class="template-section">
              <strong>Enemy Weakness:</strong>
              <div class="template-weakness">
                ${template.enemyWeakness.map(weakness => `<span class="damage-type">${weakness}</span>`).join('')}
              </div>
            </div>
          `;
        }
        
        templateCard.innerHTML = `
          <div class="template-header">
            <h3>${template.name}</h3>
            <div class="template-level">${template.level}</div>
          </div>
          <div class="template-section">
            <strong>Faction:</strong> ${template.faction || 'Unknown'}
          </div>
          <div class="template-section">
            <strong>Agent:</strong> ${template.agent || 'Any'}
          </div>
          <div class="template-section">
            <strong>Location:</strong> ${template.location || 'Various'}
          </div>
          ${damageTypes}
          ${enemyWeakness}
          <div class="template-section">
            <strong>Est. Time:</strong> ${formatDuration(template.expectedTimeMinutes || 0)}
          </div>
          <div class="template-actions">
            <button class="small-btn" data-template-id="${template.id}" data-action="use">Use</button>
            <button class="small-btn" data-template-id="${template.id}" data-action="edit">Edit</button>
            <button class="small-btn" data-template-id="${template.id}" data-action="delete">Delete</button>
          </div>
        `;
        
        templateContainer.appendChild(templateCard);
      });
      
      // Add event listeners to template action buttons
      templateContainer.querySelectorAll('button[data-action]').forEach(button => {
        button.addEventListener('click', handleTemplateAction);
      });
    } catch (error) {
      console.error('Error loading templates:', error);
      showError('Failed to load mission templates.');
    }
  }

  /**
   * Handle template action button click
   */
  async function handleTemplateAction(e) {
    const templateId = e.target.getAttribute('data-template-id');
    const action = e.target.getAttribute('data-action');
    
    if (!templateId) return;
    
    try {
      if (action === 'use') {
        await startMissionFromTemplate(templateId);
      } else if (action === 'edit') {
        await editTemplate(templateId);
      } else if (action === 'delete') {
        await deleteTemplate(templateId);
      }
    } catch (error) {
      console.error(`Error handling template action ${action}:`, error);
      showError(`Failed to ${action} template.`);
    }
  }

  /**
   * Start a new mission from a template
   */
  async function startMissionFromTemplate(templateId) {
    try {
      const template = await missionDB.getTemplate(templateId);
      if (!template) {
        showError('Template not found.');
        return;
      }
      
      // Fill in the mission form
      document.getElementById('mission-name').value = template.name;
      document.getElementById('mission-level').value = template.level;
      
      if (template.agent) {
        document.getElementById('agent-name').value = template.agent;
      }
      
      if (template.location) {
        document.getElementById('location').value = template.location;
      }
      
      if (template.faction) {
        document.getElementById('faction').value = template.faction;
      }
      
      // Check damage type checkboxes
      document.querySelectorAll('#damage-types input[type="checkbox"]').forEach(cb => {
        cb.checked = template.damageTypes && template.damageTypes.includes(cb.value);
      });
      
      // Add template notes if any
      let notes = '';
      if (template.tips) {
        notes += `Tips: ${template.tips}\n\n`;
      }
      
      if (template.encounters && template.encounters.length > 0) {
        notes += 'Encounters:\n' + template.encounters.join('\n') + '\n\n';
      }
      
      if (template.recommendedShips && template.recommendedShips.length > 0) {
        notes += 'Recommended ships: ' + template.recommendedShips.join(', ');
      }
      
      document.getElementById('mission-notes').value = notes.trim();
      
      // Show the mission modal
      showModal('new-mission-modal');
      
    } catch (error) {
      console.error('Error starting mission from template:', error);
      showError('Failed to load template.');
    }
  }

  /**
   * Edit a mission template
   */
  async function editTemplate(templateId) {
    // This would be implemented in a future version
    // For now, just show a notification
    showInfo('Template editing will be available in a future update.');
  }

  /**
   * Delete a mission template
   */
  async function deleteTemplate(templateId) {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await missionDB.deleteTemplate(templateId);
        await loadTemplates();
        showSuccess('Template deleted successfully.');
      } catch (error) {
        console.error('Error deleting template:', error);
        showError('Failed to delete template.');
      }
    }
  }

  // Public API
  const api = {
    init,
    showTab,
    showModal,
    hideModal,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showNotification,
    updateActiveMissionUI,
    displayParsedTransactions,
    displayParsedInventory,
    updateInventoryTotal,
    formatISK,
    goToMissionStep,
    resetCompleteMissionSteps,
    updateMissionSummary,
    updateExpensesTotal,
    showMissionSuggestions,
    hideMissionSuggestions,
    showMissionDetails,
    loadTemplates,
    handleTemplateAction,
    startMissionFromTemplate,
    editTemplate,
    deleteTemplate
  };
  window.UIController = api;
  return api;
})();