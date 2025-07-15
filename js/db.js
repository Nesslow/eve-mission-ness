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
            // Future object stores can be created here
            // e.g., missions, missionRuns, settings
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

// updateShip and deleteShip will be implemented later