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
        const request = store.add(ship);

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

function getShip(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readonly');
        const store = transaction.objectStore('ships');
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateShip(id, updatedShip) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readwrite');
        const store = transaction.objectStore('ships');
        
        // First get the existing ship
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const existingShip = getRequest.result;
            if (existingShip) {
                // Merge the updated fields with existing ship
                const mergedShip = { ...existingShip, ...updatedShip };
                const putRequest = store.put(mergedShip);
                
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = (event) => reject(event.target.error);
            } else {
                reject(new Error('Ship not found'));
            }
        };
        
        getRequest.onerror = (event) => reject(event.target.error);
    });
}

function deleteShip(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['ships'], 'readwrite');
        const store = transaction.objectStore('ships');
        const request = store.delete(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}