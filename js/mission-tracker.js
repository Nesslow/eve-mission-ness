/**
 * Mission Tracker for EVE Mission Tracker
 * Handles active mission tracking and timer functionality
 */

const MissionTracker = (() => {
  // Private variables
  let activeMission = null;
  let timerInterval = null;
  let startTime = null;
  
  // Store selected transactions and inventory
  let selectedTransactions = [];
  let inventoryItems = [];

  /**
   * Start a new mission
   */
  async function startMission(missionData) {
    // Check if there's already an active mission
    if (activeMission) {
      throw new Error('There is already an active mission. Please complete it first.');
    }
    
    // Create a unique ID for the mission
    const timestamp = new Date().getTime();
    const id = `mission-${missionData.date}-${timestamp}`;
    
    // Initialize mission data
    const mission = {
      id,
      ...missionData,
      income: {
        bounties: 0,
        missionReward: 0,
        timeBonus: 0,
        lootValue: 0
      },
      expenses: {
        ammo: 0,
        repairs: 0,
        other: 0
      }
    };
    
    // Save to active mission
    activeMission = mission;
    
    // Store in local storage to persist between refreshes
    localStorage.setItem('active-mission', JSON.stringify(activeMission));
    
    // Start the timer
    startTimer();
    
    // Update UI
    UIController.updateActiveMissionUI(activeMission);
    
    return activeMission;
  }

  /**
   * Complete the current mission
   */
  async function completeMission() {
    if (!activeMission) {
      throw new Error('No active mission to complete.');
    }
    
    // Stop the timer
    stopTimer();
    
    // Set end time
    const now = new Date();
    activeMission.endTime = now.toTimeString().split(' ')[0];
    
    // Calculate duration in minutes
    const startDateTime = new Date(`${activeMission.date}T${activeMission.startTime}`);
    const endDateTime = new Date(`${activeMission.date}T${activeMission.endTime}`);
    const durationMs = endDateTime - startDateTime;
    activeMission.totalTimeMinutes = Math.max(durationMs / 60000, 1); // At least 1 minute
    
    // Get transaction data
    const transactionData = getSelectedTransactions();
    activeMission.income.bounties = transactionData.bounties;
    activeMission.income.missionReward = transactionData.missionReward;
    activeMission.income.timeBonus = transactionData.timeBonus;
    
    // Get inventory value
    activeMission.income.lootValue = getInventoryValue();
    
    // Get expenses
    activeMission.expenses = {
      ammo: parseInt(document.getElementById('expense-ammo').value) || 0,
      repairs: parseInt(document.getElementById('expense-repairs').value) || 0,
      other: parseInt(document.getElementById('expense-other').value) || 0
    };
    
    // Add additional notes
    const finalNotes = document.getElementById('final-notes').value;
    if (finalNotes) {
      activeMission.notes = activeMission.notes 
        ? `${activeMission.notes}\n\n${finalNotes}`
        : finalNotes;
    }
    
    // Calculate ISK per hour
    const totalIncome = 
      activeMission.income.bounties + 
      activeMission.income.missionReward + 
      activeMission.income.timeBonus + 
      activeMission.income.lootValue;
    
    const totalExpenses = 
      activeMission.expenses.ammo + 
      activeMission.expenses.repairs + 
      activeMission.expenses.other;
    
    const profit = totalIncome - totalExpenses;
    
    // Calculate ISK/hr (per 60 minutes)
    activeMission.iskPerHour = (profit / activeMission.totalTimeMinutes) * 60;
    
    // Save completed mission to database
    await missionDB.addMission(activeMission);
    
    // Clear active mission
    localStorage.removeItem('active-mission');
    activeMission = null;
    selectedTransactions = [];
    inventoryItems = [];
    
    // Update UI
    UIController.updateActiveMissionUI(null);
    
    return true;
  }

  /**
   * Get the active mission if there is one
   */
  async function getActiveMission() {
    if (activeMission) {
      return activeMission;
    }
    
    // Check local storage for active mission
    const storedMission = localStorage.getItem('active-mission');
    if (storedMission) {
      try {
        activeMission = JSON.parse(storedMission);
        return activeMission;
      } catch (error) {
        console.error('Error parsing stored mission:', error);
        localStorage.removeItem('active-mission');
      }
    }
    
    return null;
  }

  /**
   * Start the mission timer
   */
  function startTimer() {
    startTime = new Date();
    
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // Update timer UI immediately
    updateTimerUI();
    
    // Set up interval for timer updates
    timerInterval = setInterval(updateTimerUI, 1000);
  }

  /**
   * Stop the mission timer
   */
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * Update the timer UI element
   */
  function updateTimerUI() {
    if (!activeMission) return;
    
    const now = new Date();
    const missionDate = activeMission.date || new Date().toISOString().split('T')[0];
    const missionStartTime = activeMission.startTime || '00:00:00';
    
    const startDateTime = new Date(`${missionDate}T${missionStartTime}`);
    
    let elapsedMs = now - startDateTime;
    if (elapsedMs < 0) elapsedMs = 0;
    
    const hours = Math.floor(elapsedMs / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    
    const timerDisplay = document.getElementById('mission-timer');
    if (timerDisplay) {
      timerDisplay.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      timerDisplay.classList.remove('hidden');
    }
  }

  /**
   * Set the selected transactions
   */
  function setSelectedTransactions(transactions) {
    selectedTransactions = transactions;
  }

  /**
   * Get the transaction totals from selected transactions
   */
  function getSelectedTransactions() {
    let bounties = 0;
    let missionReward = 0;
    let timeBonus = 0;
    
    selectedTransactions.forEach(tx => {
      if (tx.type === 'bounty') {
        bounties += tx.amount;
      } else if (tx.type === 'mission' && tx.description.toLowerCase().includes('time bonus')) {
        timeBonus += tx.amount;
      } else if (tx.type === 'mission') {
        missionReward += tx.amount;
      }
    });
    
    return { bounties, missionReward, timeBonus };
  }

  /**
   * Set the inventory items
   */
  function setInventoryItems(items) {
    inventoryItems = items;
  }

  /**
   * Get the total value of inventory items
   */
  function getInventoryValue() {
    return inventoryItems.reduce((total, item) => {
      return total + (item.totalValue || 0);
    }, 0);
  }

  /**
   * Start UI timer (without changing the active mission)
   */
  function startTimerUI() {
    // Check if we have an active mission
    if (!activeMission) return;
    
    // Start timer
    startTimer();
  }

  /**
   * Get the duration of the current mission in hours and minutes
   */
  function getCurrentDuration() {
    if (!activeMission) return { hours: 0, minutes: 0, seconds: 0 };
    
    const now = new Date();
    const missionDate = activeMission.date || new Date().toISOString().split('T')[0];
    const missionStartTime = activeMission.startTime || '00:00:00';
    
    const startDateTime = new Date(`${missionDate}T${missionStartTime}`);
    
    let elapsedMs = now - startDateTime;
    if (elapsedMs < 0) elapsedMs = 0;
    
    const hours = Math.floor(elapsedMs / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    
    return { hours, minutes, seconds };
  }

  // Public API
  return {
    startMission,
    completeMission,
    getActiveMission,
    startTimerUI,
    stopTimer,
    setSelectedTransactions,
    setInventoryItems,
    getCurrentDuration
  };
})();