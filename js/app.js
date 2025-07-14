/**
 * Main Application Logic for EVE Mission Tracker
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize the app
  initApp();
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Initialize UI components
    UIController.init();
    
    // Initialize market API
    await MarketAPI.init();
    
    // Add sample mission templates if needed
    await addSampleTemplates();
    
    // Load initial data
    await loadDashboardData();
    
    // Check if there's an active mission
    const activeMission = await MissionTracker.getActiveMission();
    if (activeMission) {
      UIController.updateActiveMissionUI(activeMission);
      MissionTracker.startTimerUI();
    }
    
    // Load mission templates for templates tab
    await UIController.loadTemplates();
    
    console.log('App initialized successfully');
    UIController.showInfo('Application loaded successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
    UIController.showError('Failed to initialize the application. Please refresh the page.');
  }
}

/**
 * Add sample mission templates if none exist
 */
async function addSampleTemplates() {
  try {
    const templates = await missionDB.getAllTemplates();
    
    // Only add samples if no templates exist
    if (templates && templates.length === 0) {
      const sampleTemplates = [
        {
          id: "template-angel-extravaganza",
          name: "Angel Extravaganza",
          level: 4,
          faction: "Angel Cartel",
          agent: "Hulda Thorsson",
          location: "Hek",
          damageTypes: ["Explosive", "Kinetic"],
          enemyWeakness: ["EM", "Thermal"],
          encounters: [
            "3 battleships in first room",
            "2 battleships + 5 cruisers in second room"
          ],
          tips: "Bring Explosive hardeners, focus on battleships first",
          expectedTimeMinutes: 60,
          recommendedShips: ["Dominix", "Rattlesnake"],
          averageReward: 875000,
          averageTimeBonus: 250000,
          averageBounties: 1500000
        },
        {
          id: "template-worlds-collide",
          name: "Worlds Collide",
          level: 4,
          faction: "Guristas",
          agent: "Matias Tuominen",
          location: "Jita",
          damageTypes: ["Kinetic", "Thermal"],
          enemyWeakness: ["EM"],
          encounters: [
            "Multiple frigates and cruisers",
            "Heavy ECM jammers"
          ],
          tips: "Bring ECM protection, use drones",
          expectedTimeMinutes: 45,
          recommendedShips: ["Gila", "Ishtar"],
          averageReward: 950000,
          averageTimeBonus: 300000,
          averageBounties: 2000000
        },
        {
          id: "template-recon-1-3",
          name: "Recon (Part 1/3)",
          level: 4,
          faction: "Amarr Empire",
          agent: "Arim Ardishapur",
          location: "Amarr",
          damageTypes: ["EM", "Thermal"],
          enemyWeakness: ["Kinetic", "Explosive"],
          encounters: [
            "Heavy laser damage",
            "Several battleships with cruiser support"
          ],
          tips: "Strong EM resistance recommended",
          expectedTimeMinutes: 40,
          recommendedShips: ["Tempest", "Raven"],
          averageReward: 780000,
          averageTimeBonus: 200000,
          averageBounties: 1200000
        }
      ];
      
      for (const template of sampleTemplates) {
        await missionDB.addTemplate(template);
      }
      
      console.log("Added sample mission templates");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error adding sample templates:", error);
    return false;
  }
}

/**
 * Load dashboard data from the database
 */
async function loadDashboardData() {
  try {
    // Get all missions
    const missions = await missionDB.getAllMissions();
    
    // Update stats
    updateStats(missions);
    
    // Load charts
    loadCharts(missions);
    
    // Update recent missions list
    updateRecentMissions(missions);
    
    // Update missions table
    updateMissionsTable(missions);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    UIController.showError('Failed to load mission data.');
  }
}

/**
 * Update statistics based on mission data
 */
function updateStats(missions) {
  if (!missions || missions.length === 0) {
    return;
  }
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Filter missions for today
  const todayMissions = missions.filter(mission => mission.date === today);
  
  // Calculate today's stats
  const todayCount = todayMissions.length;
  const todayEarnings = todayMissions.reduce((total, mission) => {
    const income = 
      (mission.income.bounties || 0) + 
      (mission.income.missionReward || 0) + 
      (mission.income.timeBonus || 0) + 
      (mission.income.lootValue || 0);
    
    const expenses = 
      (mission.expenses.ammo || 0) + 
      (mission.expenses.repairs || 0) + 
      (mission.expenses.other || 0);
    
    return total + (income - expenses);
  }, 0);
  
  // Calculate total time spent today in minutes
  const todayTimeMinutes = todayMissions.reduce((total, mission) => {
    return total + (mission.totalTimeMinutes || 0);
  }, 0);
  
  // Calculate ISK/hr for today
  const todayIskPerHour = todayTimeMinutes > 0 
    ? (todayEarnings / todayTimeMinutes) * 60 
    : 0;
  
  // Update UI
  document.getElementById('today-missions').textContent = todayCount;
  document.getElementById('today-isk').textContent = formatISK(todayEarnings);
  document.getElementById('today-iskhr').textContent = formatISK(todayIskPerHour) + '/hr';
  
  // Calculate overall stats
  const totalMissions = missions.length;
  const allTimeEarnings = missions.reduce((total, mission) => {
    const income = 
      (mission.income.bounties || 0) + 
      (mission.income.missionReward || 0) + 
      (mission.income.timeBonus || 0) + 
      (mission.income.lootValue || 0);
    
    const expenses = 
      (mission.expenses.ammo || 0) + 
      (mission.expenses.repairs || 0) + 
      (mission.expenses.other || 0);
    
    return total + (income - expenses);
  }, 0);
  
  const totalTimeMinutes = missions.reduce((total, mission) => {
    return total + (mission.totalTimeMinutes || 0);
  }, 0);
  
  const avgIskPerHour = totalTimeMinutes > 0 
    ? (allTimeEarnings / totalTimeMinutes) * 60 
    : 0;
  
  // Find most profitable mission
  let mostProfitable = null;
  let highestIskHr = 0;
  
  missions.forEach(mission => {
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
    const iskHr = mission.iskPerHour || 0;
    
    if (iskHr > highestIskHr) {
      highestIskHr = iskHr;
      mostProfitable = mission;
    }
  });
  
  // Update UI
  document.getElementById('total-missions').textContent = totalMissions;
  document.getElementById('avg-iskhr').textContent = formatISK(avgIskPerHour) + '/hr';
  document.getElementById('best-mission').textContent = mostProfitable 
    ? `${mostProfitable.missionName} (${formatISK(highestIskHr)}/hr)` 
    : 'N/A';
}

/**
 * Load chart data
 */
function loadCharts(missions) {
  if (!missions || missions.length === 0) {
    return;
  }
  
  ChartUtils.createEarningsChart(missions);
  ChartUtils.createMissionComparisonChart(missions);
}

/**
 * Update recent missions list
 */
function updateRecentMissions(missions) {
  const recentMissionsList = document.getElementById('recent-mission-list');
  
  // Clear current content
  recentMissionsList.innerHTML = '';
  
  if (!missions || missions.length === 0) {
    recentMissionsList.innerHTML = '<li class="empty-list">No recent missions</li>';
    return;
  }
  
  // Sort missions by date (newest first)
  const sortedMissions = [...missions].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.endTime || '00:00:00'}`);
    const dateB = new Date(`${b.date}T${b.endTime || '00:00:00'}`);
    return dateB - dateA;
  });
  
  // Take the 5 most recent missions
  const recentMissions = sortedMissions.slice(0, 5);
  
  recentMissions.forEach(mission => {
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
    
    const listItem = document.createElement('li');
    listItem.className = 'recent-mission-item';
    listItem.innerHTML = `
      <div>
        <strong>${mission.missionName}</strong> (${mission.date})
      </div>
      <div>${formatISK(profit)}</div>
    `;
    
    recentMissionsList.appendChild(listItem);
  });
}

/**
 * Update missions table
 */
function updateMissionsTable(missions) {
  const tableBody = document.getElementById('missions-table-body');
  
  // Clear current content
  tableBody.innerHTML = '';
  
  if (!missions || missions.length === 0) {
    tableBody.innerHTML = '<tr class="empty-table"><td colspan="9">No missions recorded</td></tr>';
    return;
  }
  
  // Sort missions by date (newest first)
  const sortedMissions = [...missions].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.endTime || '00:00:00'}`);
    const dateB = new Date(`${b.date}T${b.endTime || '00:00:00'}`);
    return dateB - dateA;
  });
  
  sortedMissions.forEach(mission => {
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
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${mission.date}</td>
      <td>${mission.missionName}</td>
      <td>${mission.missionLevel}</td>
      <td>${formatDuration(mission.totalTimeMinutes)}</td>
      <td>${formatISK(income)}</td>
      <td>${formatISK(expenses)}</td>
      <td>${formatISK(profit)}</td>
      <td>${formatISK(mission.iskPerHour || 0)}/hr</td>
      <td>
        <button class="small-btn" data-mission-id="${mission.id}" data-action="view">View</button>
        <button class="small-btn" data-mission-id="${mission.id}" data-action="delete">Delete</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to action buttons
  tableBody.querySelectorAll('button[data-action]').forEach(button => {
    button.addEventListener('click', async (e) => {
      const missionId = e.target.getAttribute('data-mission-id');
      const action = e.target.getAttribute('data-action');
      
      if (action === 'view') {
        // View mission details
        const mission = await missionDB.getMission(missionId);
        if (mission) {
          UIController.showMissionDetails(mission);
        }
      } else if (action === 'delete') {
        // Confirm delete
        if (confirm('Are you sure you want to delete this mission?')) {
          await missionDB.deleteMission(missionId);
          await loadDashboardData();
        }
      }
    });
  });
}

/**
 * Validate the new mission form
 */
function validateMissionForm() {
  const missionName = document.getElementById('mission-name').value.trim();
  if (!missionName) {
    UIController.showError('Mission name is required');
    return false;
  }
  
  const missionLevel = parseInt(document.getElementById('mission-level').value);
  if (isNaN(missionLevel) || missionLevel < 1 || missionLevel > 5) {
    UIController.showError('Invalid mission level');
    return false;
  }
  
  return true;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabId = e.target.getAttribute('data-tab');
      UIController.showTab(tabId);
    });
  });
  
  // Start mission button
  document.getElementById('start-mission-btn').addEventListener('click', () => {
    UIController.showModal('new-mission-modal');
  });
  
  // End mission button
  document.getElementById('end-mission-btn').addEventListener('click', async () => {
    const activeMission = await MissionTracker.getActiveMission();
    if (activeMission) {
      document.getElementById('complete-mission-name').textContent = activeMission.missionName;
      UIController.showModal('complete-mission-modal');
      UIController.resetCompleteMissionSteps();
    }
  });
  
  // New mission form submission
  document.getElementById('new-mission-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateMissionForm()) {
      return;
    }
    
    const missionData = {
      missionName: document.getElementById('mission-name').value,
      missionLevel: parseInt(document.getElementById('mission-level').value),
      agent: document.getElementById('agent-name').value,
      location: document.getElementById('location').value,
      faction: document.getElementById('faction').value,
      damageTypes: Array.from(document.querySelectorAll('#damage-types input:checked')).map(cb => cb.value),
      notes: document.getElementById('mission-notes').value,
      date: new Date().toISOString().split('T')[0],
      startTime: new Date().toTimeString().split(' ')[0]
    };
    
    try {
      await MissionTracker.startMission(missionData);
      UIController.hideModal('new-mission-modal');
      UIController.showSuccess('Mission started successfully.');
    } catch (error) {
      console.error('Error starting mission:', error);
      UIController.showError('Failed to start mission: ' + error.message);
    }
  });
  
  // Close modal buttons
  document.querySelectorAll('.close-modal, .close-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      // Find the closest modal parent
      const modal = e.target.closest('.modal');
      if (modal) {
        UIController.hideModal(modal.id);
      }
    });
  });
  
  // Transaction paste handling
  document.getElementById('transaction-paste').addEventListener('input', (e) => {
    const text = e.target.value;
    if (text.trim()) {
      const parsedTransactions = TransactionParser.parse(text);
      UIController.displayParsedTransactions(parsedTransactions);
      
      // Enable next button if we have transactions
      document.getElementById('tx-next-btn').disabled = parsedTransactions.length === 0;
    } else {
      document.getElementById('tx-next-btn').disabled = true;
      document.getElementById('parsed-transactions').classList.add('hidden');
    }
  });
  
  // Transaction selection controls
  document.getElementById('select-all-tx').addEventListener('click', () => {
    document.querySelectorAll('#transaction-list input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
  });
  
  document.getElementById('deselect-all-tx').addEventListener('click', () => {
    document.querySelectorAll('#transaction-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
  });
  
  // Inventory paste handling
  document.getElementById('inventory-paste').addEventListener('input', (e) => {
    const text = e.target.value;
    if (text.trim()) {
      const parsedInventory = InventoryParser.parse(text);
      UIController.displayParsedInventory(parsedInventory);
      
      // Enable next button if we have items
      document.getElementById('inv-next-btn').disabled = parsedInventory.length === 0;
    } else {
      document.getElementById('inv-next-btn').disabled = true;
      document.getElementById('parsed-inventory').classList.add('hidden');
    }
  });
  
  // Step navigation in complete mission modal
  document.getElementById('tx-next-btn').addEventListener('click', () => {
    UIController.goToMissionStep(2);
  });
  
  document.getElementById('inv-prev-btn').addEventListener('click', () => {
    UIController.goToMissionStep(1);
  });
  
  document.getElementById('inv-next-btn').addEventListener('click', async () => {
    UIController.goToMissionStep(3);
    await UIController.updateMissionSummary();
  });
  
  document.getElementById('summary-prev-btn').addEventListener('click', () => {
    UIController.goToMissionStep(2);
  });
  
  // Save mission button
  document.getElementById('save-mission-btn').addEventListener('click', async () => {
    try {
      await MissionTracker.completeMission();
      UIController.hideModal('complete-mission-modal');
      await loadDashboardData();
      UIController.showSuccess('Mission completed and saved successfully.');
    } catch (error) {
      console.error('Error completing mission:', error);
      UIController.showError('Failed to complete mission.');
    }
  });
  
  // Expense inputs updating summary
  document.querySelectorAll('#expense-ammo, #expense-repairs, #expense-other').forEach(input => {
    input.addEventListener('input', UIController.updateExpensesTotal);
  });
  
  // Mission search and filter
  document.getElementById('mission-search').addEventListener('input', filterMissions);
  document.getElementById('mission-filter').addEventListener('change', filterMissions);
  
  // Mission name input - show suggestions
  document.getElementById('mission-name').addEventListener('input', async (e) => {
    const searchTerm = e.target.value.trim();
    if (searchTerm.length >= 2) {
      const templates = await missionDB.getAllTemplates();
      const filteredTemplates = templates.filter(template => 
        template.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      UIController.showMissionSuggestions(filteredTemplates);
    } else {
      UIController.hideMissionSuggestions();
    }
  });
  
  // Settings controls
  document.getElementById('export-data').addEventListener('click', async () => {
    try {
      const data = await missionDB.exportData();
      
      // Convert to JSON string
      const jsonString = JSON.stringify(data, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `eve-mission-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      UIController.showSuccess('Data exported successfully.');
    } catch (error) {
      console.error('Error exporting data:', error);
      UIController.showError('Failed to export data.');
    }
  });
  
  document.getElementById('import-data').addEventListener('click', () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (await missionDB.importData(data)) {
          await loadDashboardData();
          UIController.showSuccess('Data imported successfully.');
        } else {
          UIController.showError('Failed to import data.');
        }
      } catch (error) {
        console.error('Error importing data:', error);
        UIController.showError('Invalid data file.');
      }
    });
    
    // Trigger file selection
    fileInput.click();
  });
  
  document.getElementById('reset-data').addEventListener('click', () => {
    if (confirm('WARNING: This will delete all your mission data and templates. This action cannot be undone. Are you sure you want to proceed?')) {
      if (confirm('Are you REALLY sure? All data will be permanently deleted.')) {
        // Clear IndexedDB
        indexedDB.deleteDatabase(DB_NAME);
        
        // Reload the page to reinitialize the database
        location.reload();
      }
    }
  });
  
  // Save settings
  document.querySelectorAll('#price-hub, #refresh-prices').forEach(setting => {
    setting.addEventListener('change', async (e) => {
      const id = e.target.id;
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      
      try {
        await missionDB.setSetting(id, value);
        UIController.showSuccess('Settings saved.');
      } catch (error) {
        console.error('Error saving setting:', error);
      }
    });
  });
  
  // Default expenses
  document.querySelectorAll('#default-ammo, #default-repairs').forEach(setting => {
    setting.addEventListener('change', async (e) => {
      try {
        const defaultExpenses = {
          ammo: parseInt(document.getElementById('default-ammo').value) || 0,
          repairs: parseInt(document.getElementById('default-repairs').value) || 0
        };
        
        await missionDB.setSetting('defaultExpenses', defaultExpenses);
        UIController.showSuccess('Default expenses saved.');
      } catch (error) {
        console.error('Error saving default expenses:', error);
      }
    });
  });
  
  // Add global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only process if no modals are open
    const activeModals = document.querySelectorAll('.modal:not(.hidden)');
    if (activeModals.length > 0) return;
    
    // Alt+S: Start new mission
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      const activeMissionPromise = MissionTracker.getActiveMission();
      activeMissionPromise.then(activeMission => {
        if (!activeMission) {
          UIController.showModal('new-mission-modal');
        } else {
          UIController.showInfo('You already have an active mission.');
        }
      });
    }
    
    // Alt+E: End current mission
    if (e.altKey && e.key === 'e') {
      e.preventDefault();
      const activeMissionPromise = MissionTracker.getActiveMission();
      activeMissionPromise.then(activeMission => {
        if (activeMission) {
          document.getElementById('end-mission-btn').click();
        } else {
          UIController.showInfo('No active mission to complete.');
        }
      });
    }
    
    // Alt+D: View dashboard
    if (e.altKey && e.key === 'd') {
      e.preventDefault();
      UIController.showTab('dashboard');
    }
    
    // Alt+M: View missions
    if (e.altKey && e.key === 'm') {
      e.preventDefault();
      UIController.showTab('missions');
    }
  });
}

/**
 * Filter missions in the missions table
 */
async function filterMissions() {
  const searchTerm = document.getElementById('mission-search').value.toLowerCase();
  const filterValue = document.getElementById('mission-filter').value;
  
  // Get all missions
  const missions = await missionDB.getAllMissions();
  
  // Apply filters
  const filteredMissions = missions.filter(mission => {
    // Apply search filter
    const matchesSearch = 
      mission.missionName.toLowerCase().includes(searchTerm) ||
      (mission.agent && mission.agent.toLowerCase().includes(searchTerm)) ||
      (mission.location && mission.location.toLowerCase().includes(searchTerm));
    
    // Apply level filter
    const matchesLevel = filterValue === 'all' || mission.missionLevel.toString() === filterValue;
    
    return matchesSearch && matchesLevel;
  });
  
  // Update table
  updateMissionsTable(filteredMissions);
}

/**
 * Format ISK value with commas and abbreviations for large numbers
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