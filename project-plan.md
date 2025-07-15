# EVE Online Mission Tracker - Project Plan

### **Project Metadata**
- **Project Name:** EVE Online Mission Tracker
- **Project Owner:** @Nesslow
- **Last Updated:** 2025-07-15 09:30:32 UTC
- **Scope:** Private, client-side web application for personal mission tracking.
- **Core Technologies:** HTML5, CSS3, JavaScript (ES6+), IndexedDB.
- **Hosting:** GitHub Pages.
- **External APIs:**
  - **Primary:** Fuzzwork Market API (`https://market.fuzzwork.co.uk/api/`) for item name resolution and pricing.
  - **Secondary/Fallback:** EVE Swagger Interface (ESI) (`https://esi.evetech.net/`) for market data.

---

### **Design Principles & UI/UX Guidelines**

This section outlines the design philosophy for the application.

1.  **CSS**

2.  **Look and Feel:**
    - **Theme:** Dark theme by default. The design should feel like a professional utility tool, inspired by the dark, futuristic aesthetic of EVE Online.
    - **Layout:** A simple, responsive two-column layout.
      - A fixed navigation sidebar on the left for main sections (Dashboard, Hangar, Missions, History, Reports, Settings).
      - A main content area on the right that updates based on the selected section.
    - **Typography & Spacing:** Prioritize readability and clarity. Data tables, forms, and lists should be well-spaced. Use a clean, sans-serif font.
    - **Interactivity:** Keep interactions simple and intuitive. Use the standard `<dialog>` element for modals and confirmation prompts. Avoid unnecessary animations. The application should feel fast and responsive.

---

### **Guiding Principles for AI Agents**

This document outlines the development plan for a client-side EVE Online mission tracking application. As an AI assistant, your tasks will be based on the phases described below.

1.  **Client-Side First:** All data is stored locally in the user's browser via IndexedDB. There is no backend server or database. All logic for data manipulation, API calls, and calculations must be written in client-side JavaScript.
2.  **Modular Codebase:** The application's JavaScript should be organized into distinct modules to handle specific concerns:
    - `db.js`: Manages all interactions with IndexedDB.
    - `api.js`: Handles all external API calls (Fuzzwork, ESI).
    - `parser.js`: Contains logic for parsing pasted in-game data (fittings, loot, bounties).
    - `app.js`: The main application logic, handling UI events and orchestrating the other modules.
3.  **Data-Driven UI:** The user interface should dynamically render based on the data stored in IndexedDB.
4.  **Semantic HTML:** Write clean, semantic HTML to leverage the Pico.css framework effectively. Use tags like `<main>`, `<section>`, `<article>`, `<nav>`, and `<figure>` appropriately.

---

### **Core Data Models**

The application will be built around these core data structures.

#### `Mission`
Represents a static, reusable mission definition.

```javascript
{
  id: "unique_id", // e.g., timestamp or UUID
  name: "The Blockade",
  level: 4, // integer 1-5
  enemyFaction: "Guristas Pirates",
  damageToDeal: "Kinetic",
  damageToResist: "Kinetic/Thermal",
  baseIskReward: 1200000,
  baseLpReward: 1500,
  notes: "Final battleship is the trigger for the next wave.",
  tags: ["blitz", "high-sec"]
}
```

#### `Ship`
Represents a user's ship and its associated fitting, managed in the "Hangar".

```javascript
{
  id: "unique_id",
  name: "My Mission Gila",
  type: "Gila",
  fitting: "...", // Raw pasted fitting data from the game
  value: 850000000, // Calculated value of hull + modules
  checklist: [
    "Rapid Light Missile Launchers fitted",
    "Medium Drones in bay",
    "Mobile Tractor Unit in cargo"
  ],
  isActive: true // boolean
}
```

#### `MissionRun`
A record of a single, completed mission instance.

```javascript
{
  id: "unique_id",
  missionId: "id_of_the_mission",
  shipId: "id_of_the_ship_used",
  startTime: "YYYY-MM-DDTHH:mm:ss.sssZ",
  endTime: "YYYY-MM-DDTHH:mm:ss.sssZ",
  status: "Completed", // or "Aborted"
  rawBounties: "...", // Pasted transaction log
  rawLoot: "...", // Pasted loot list
  rawSalvage: "...", // Pasted salvage list
  bountiesValue: 25000000, // Calculated value
  lootValue: 15000000, // Calculated value
  salvageValue: 10000000, // Calculated value
  expenses: [
    { description: "Lost Drone", cost: 1500000 }
  ],
  liveLog: "Encountered a rare spawn in the first pocket."
}
```

#### `Settings`
Stores user-specific application settings.

```javascript
{
  iskPerLpRate: 2000
}
```

---

### **Feature Roadmap & Instructions**

#### **Phase 1: Foundation & The Hangar**

1.  **Task 1.1: Project Initialization:**
    - Create the repository on GitHub.
    - Enable GitHub Pages to serve from the `main` branch.
    - Create the initial file structure: `index.html`, `style.css`, `js/app.js`, `js/db.js`, `js/api.js`, `js/parser.js`.
    - Add Pico.css CDN link to `index.html`.

2.  **Task 1.2: Hangar Implementation:**
    - Build the "Hangar" section in `index.html`.
    - Implement a UI with a form to add a new ship. The form should include fields for `name` and a textarea for `fitting`.
    - Implement the logic in `db.js` to save, update, and retrieve ship data from IndexedDB.
    - Display all saved ships in a list within the Hangar.

3.  **Task 1.3: Ship Parser & Pricer:**
    - In `parser.js`, create a function to parse the raw fitting data into a list of item names (hull + modules).
    - In `api.js`, create a function that takes this list, queries the Fuzzwork API for prices, and returns a total `value`.
    - Integrate these functions so that when a ship is saved, its value is automatically calculated and stored.

4.  **Task 1.4: Ship-Specific Checklist Management:**
    - In the Hangar UI for each ship, add an interface to add, edit, and delete checklist items.
    - Update the `Ship` data model and `db.js` to store the `checklist` array.

5.  **Task 1.5: Mission Database:**
    - Create a "Missions" section in the UI.
    - Implement a form and database logic to manage `Mission` entries as defined in the data model.

#### **Phase 2: The Mission Loop**

1.  **Task 2.1: Pre-Mission Confirmation Screen:**
    - When a user clicks "Start" on a mission, show a confirmation modal/page using the `<dialog>` element.
    - This screen must display the checklist for the `isActive` ship.
    - Include a dropdown to allow selecting a different ship from the Hangar, which will dynamically update the displayed checklist.

2.  **Task 2.2: Active Mission Dashboard:**
    - After confirmation, transition to the "Active Run" view.
    - This view must contain a live timer with "Pause" and "Resume" buttons.
    - Display key mission data (name, damage types) and a `liveLog` textarea.

3.  **Task 2.3: Completion & Data Entry Form:**
    - The "Complete Mission" button should stop the timer and present a form for logging results.
    - The form must have three separate textareas for pasting `rawBounties`, `rawLoot`, and `rawSalvage`.
    - It should also have an interface for logging `expenses`.

4.  **Task 2.4: Mission Run History & Editing:**
    - Create a "History" section to display all saved `MissionRun` records.
    - Each record must have an "Edit" button that opens the completion form populated with the existing data, allowing for corrections.

#### **Phase 3: Core Logic - Parsing & Valuation**

1.  **Task 3.1: Unified Parser Module:**
    - Refactor and expand `parser.js` to handle all parsing needs. It should contain functions for:
      - `parseFitting(text)`
      - `parseLoot(text)` (handles item lists from cargo/wrecks)
      - `parseBounties(text)` (parses the in-game transaction log)

2.  **Task 3.2: Valuation Integration:**
    - Use the parser functions to process the raw data from the completion form.
    - Feed the parsed item lists into the `api.js` pricing function.
    - Save the final calculated `bountiesValue`, `lootValue`, and `salvageValue` into the `MissionRun` record.

3.  **Task 3.3: LP Valuation Settings:**
    - Create a "Settings" page in the UI.
    - Add an input for the user to set their desired `iskPerLpRate`.
    - Save this value in the `Settings` object store in IndexedDB.

#### **Phase 4: Analytics & Maintenance**

1.  **Task 4.1: Reporting Dashboard:**
    - Create a "Reports" page in the UI.
    - Fetch all `MissionRun` data from the database.

2.  **Task 4.2: Core Metric Calculation Logic:**
    - Implement JavaScript functions to calculate key analytics:
      - `TotalNetGain = (BountiesValue + LootValue + SalvageValue + (baseLpReward * iskPerLpRate)) - TotalExpenses`
      - `ISKPerHour = TotalNetGain / (Duration in hours)`
    - Display these metrics and use a charting library (e.g., Chart.js) to create visualizations (e.g., ISK/hour by mission).

3.  **Task 4.3: Data Backup & Restore:**
    - On the Settings page, add two buttons: "Export Data" and "Import Data".
    - "Export" should read the entire IndexedDB database and save it as a single JSON file.
    - "Import" should allow uploading a JSON file, which will then clear and repopulate the database.