/**
 * Database setup for EVE Mission Tracker
 * Uses IndexedDB for client-side storage
 */

const DB_NAME = 'EveMissionTracker';
const DB_VERSION = 1;

class MissionDB {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyCallbacks = [];
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is supported
      if (!window.indexedDB) {
        console.error("Your browser doesn't support IndexedDB.");
        reject("IndexedDB not supported");
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("Database error:", event.target.error);
        reject("Error opening database");
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        
        // Call any callbacks waiting for DB to be ready
        this.readyCallbacks.forEach(callback => callback());
        this.readyCallbacks = [];
        
        console.log("Database opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create missions store
        if (!db.objectStoreNames.contains('missions')) {
          const missionsStore = db.createObjectStore('missions', { keyPath: 'id' });
          missionsStore.createIndex('date', 'date', { unique: false });
          missionsStore.createIndex('missionName', 'missionName', { unique: false });
          missionsStore.createIndex('missionLevel', 'missionLevel', { unique: false });
        }

        // Create mission templates store
        if (!db.objectStoreNames.contains('missionTemplates')) {
          const templatesStore = db.createObjectStore('missionTemplates', { keyPath: 'id' });
          templatesStore.createIndex('name', 'name', { unique: false });
          templatesStore.createIndex('level', 'level', { unique: false });
          templatesStore.createIndex('faction', 'faction', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        console.log("Database setup complete");
      };
    });
  }

  // Helper to ensure DB is ready before operations
  async ensureReady() {
    if (this.isReady) return Promise.resolve();
    
    return new Promise(resolve => {
      this.readyCallbacks.push(resolve);
    });
  }

  // Add a new mission
  async addMission(missionData) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missions'], 'readwrite');
      const store = transaction.objectStore('missions');
      
      const request = store.add(missionData);
      
      request.onsuccess = () => {
        console.log("Mission added successfully");
        resolve(missionData.id);
      };
      
      request.onerror = (event) => {
        console.error("Error adding mission:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Get a mission by ID
  async getMission(id) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missions'], 'readonly');
      const store = transaction.objectStore('missions');
      
      const request = store.get(id);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error("Error getting mission:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Get all missions
  async getAllMissions() {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missions'], 'readonly');
      const store = transaction.objectStore('missions');
      
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error("Error getting all missions:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Update a mission
  async updateMission(missionData) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missions'], 'readwrite');
      const store = transaction.objectStore('missions');
      
      const request = store.put(missionData);
      
      request.onsuccess = () => {
        console.log("Mission updated successfully");
        resolve();
      };
      
      request.onerror = (event) => {
        console.error("Error updating mission:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Delete a mission
  async deleteMission(id) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missions'], 'readwrite');
      const store = transaction.objectStore('missions');
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log("Mission deleted successfully");
        resolve();
      };
      
      request.onerror = (event) => {
        console.error("Error deleting mission:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Mission Templates Methods
  async addTemplate(templateData) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missionTemplates'], 'readwrite');
      const store = transaction.objectStore('missionTemplates');
      
      const request = store.add(templateData);
      
      request.onsuccess = () => {
        console.log("Template added successfully");
        resolve(templateData.id);
      };
      
      request.onerror = (event) => {
        console.error("Error adding template:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getAllTemplates() {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missionTemplates'], 'readonly');
      const store = transaction.objectStore('missionTemplates');
      
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error("Error getting all templates:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getTemplate(id) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missionTemplates'], 'readonly');
      const store = transaction.objectStore('missionTemplates');
      
      const request = store.get(id);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error("Error getting template:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async deleteTemplate(id) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['missionTemplates'], 'readwrite');
      const store = transaction.objectStore('missionTemplates');
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log("Template deleted successfully");
        resolve();
      };
      
      request.onerror = (event) => {
        console.error("Error deleting template:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Settings Methods
  async getSetting(id) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const request = store.get(id);
      
      request.onsuccess = (event) => {
        resolve(event.target.result ? event.target.result.value : null);
      };
      
      request.onerror = (event) => {
        console.error("Error getting setting:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async setSetting(id, value) {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const request = store.put({ id, value });
      
      request.onsuccess = () => {
        console.log(`Setting ${id} saved successfully`);
        resolve();
      };
      
      request.onerror = (event) => {
        console.error("Error saving setting:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Data Export/Import
  async exportData() {
    await this.ensureReady();
    
    const missions = await this.getAllMissions();
    const templates = await this.getAllTemplates();
    
    // Get settings
    const settings = {};
    const settingKeys = ['defaultPriceHub', 'refreshPricesOnLoad', 'defaultExpenses', 'activeShip'];
    
    for (const key of settingKeys) {
      settings[key] = await this.getSetting(key);
    }
    
    return {
      missions,
      missionTemplates: templates,
      settings
    };
  }

  async importData(data) {
    await this.ensureReady();
    
    // Clear existing data
    const clearStore = async (storeName) => {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log(`${storeName} store cleared`);
          resolve();
        };
        
        request.onerror = (event) => {
          console.error(`Error clearing ${storeName} store:`, event.target.error);
          reject(event.target.error);
        };
      });
    };
    
    try {
      // Clear stores
      await clearStore('missions');
      await clearStore('missionTemplates');
      
      // Import missions
      if (data.missions && Array.isArray(data.missions)) {
        const missionPromises = data.missions.map(mission => this.addMission(mission));
        await Promise.all(missionPromises);
      }
      
      // Import templates
      if (data.missionTemplates && Array.isArray(data.missionTemplates)) {
        const templatePromises = data.missionTemplates.map(template => this.addTemplate(template));
        await Promise.all(templatePromises);
      }
      
      // Import settings
      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          if (value !== null && value !== undefined) {
            await this.setSetting(key, value);
          }
        }
      }
      
      console.log("Data import completed successfully");
      return true;
    } catch (error) {
      console.error("Error importing data:", error);
      return false;
    }
  }
}

// Create and export a single instance
const missionDB = new MissionDB();

// Initialize the database when the script is loaded
missionDB.init().catch(error => {
  console.error("Failed to initialize database:", error);
});