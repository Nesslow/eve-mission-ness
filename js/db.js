// IndexedDB interaction logic
console.log("db.js loaded");

const DB_NAME = 'EVE_MISSION_TRACKER_DB';
const DB_VERSION = 1;
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('ships')) {
                db.createObjectStore('ships', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('missions')) {
                db.createObjectStore('missions', { keyPath: 'id', autoIncrement: true });
            }
            // Future object stores can be created here
            // e.g., missionRuns, settings
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized successfully.");
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("Database error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

function addShip(ship) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readwrite');
        const store = transaction.objectStore('ships');
        
        // Ensure ship has required fields with defaults
        const shipData = {
            name: ship.name || '',
            type: ship.type || '',
            fitting: ship.fitting || '',
            value: ship.value || 0,
            checklist: ship.checklist || [],
            isActive: ship.isActive || false,
            ...ship // Allow override of defaults
        };
        
        const request = store.add(shipData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function getShips() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readonly');
        const store = transaction.objectStore('ships');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateShip(shipId, updateData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readwrite');
        const store = transaction.objectStore('ships');
        
        // First get the existing ship
        const getRequest = store.get(shipId);
        
        getRequest.onsuccess = () => {
            const ship = getRequest.result;
            if (!ship) {
                reject(new Error('Ship not found'));
                return;
            }
            
            // Update the ship with new data
            const updatedShip = { ...ship, ...updateData };
            
            // Save the updated ship
            const putRequest = store.put(updatedShip);
            putRequest.onsuccess = () => resolve(updatedShip);
            putRequest.onerror = (event) => reject(event.target.error);
        };
        
        getRequest.onerror = (event) => reject(event.target.error);
    });
}

function deleteShip(shipId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readwrite');
        const store = transaction.objectStore('ships');
        
        const request = store.delete(shipId);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// Mission CRUD functions
function addMission(mission) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['missions'], 'readwrite');
        const store = transaction.objectStore('missions');
        
        // Ensure mission has required fields with defaults
        const missionData = {
            name: mission.name || '',
            level: mission.level || 1,
            enemyFaction: mission.enemyFaction || '',
            damageToDeal: mission.damageToDeal || '',
            damageToResist: mission.damageToResist || '',
            baseIskReward: mission.baseIskReward || 0,
            baseLpReward: mission.baseLpReward || 0,
            notes: mission.notes || '',
            tags: mission.tags || [],
            ...mission // Allow override of defaults
        };
        
        const request = store.add(missionData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function getMissions() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['missions'], 'readonly');
        const store = transaction.objectStore('missions');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateMission(missionId, updateData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['missions'], 'readwrite');
        const store = transaction.objectStore('missions');
        
        // First get the existing mission
        const getRequest = store.get(missionId);
        
        getRequest.onsuccess = () => {
            const mission = getRequest.result;
            if (!mission) {
                reject(new Error('Mission not found'));
                return;
            }
            
            // Update the mission with new data
            const updatedMission = { ...mission, ...updateData };
            
            // Save the updated mission
            const putRequest = store.put(updatedMission);
            putRequest.onsuccess = () => resolve(updatedMission);
            putRequest.onerror = (event) => reject(event.target.error);
        };
        
        getRequest.onerror = (event) => reject(event.target.error);
    });
}

function deleteMission(missionId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['missions'], 'readwrite');
        const store = transaction.objectStore('missions');
        
        const request = store.delete(missionId);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}