// Main application logic
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. Initializing app.");

    await initDB(); // Initialize the database

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('#main-content section');
    const addShipForm = document.getElementById('add-ship-form');
    const shipListDiv = document.getElementById('ship-list');
    const addMissionForm = document.getElementById('add-mission-form');
    const missionListDiv = document.getElementById('mission-list');
    
    // Mobile navigation elements
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('nav');
    const navOverlay = document.querySelector('.nav-overlay');

    // --- Mobile Navigation ---
    function toggleMobileNav() {
        nav.classList.toggle('active');
        navOverlay.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    }

    function closeMobileNav() {
        nav.classList.remove('active');
        navOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', toggleMobileNav);
    navOverlay.addEventListener('click', closeMobileNav);

    // Close mobile nav when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileNav);
    });

    // Close mobile nav on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('active')) {
            closeMobileNav();
        }
    });

    // --- Navigation ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');

            // Update active states
            navLinks.forEach(l => l.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'page');

            sections.forEach(section => {
                section.style.display = (section.id === targetId) ? 'block' : 'none';
            });
            
            // Load data when switching to specific sections
            if (targetId === 'hangar-section') {
                renderShips();
            } else if (targetId === 'missions-section') {
                renderMissions();
            }
        });
    });

    // --- Hangar Logic ---
    async function renderShips() {
        const ships = await getShips();
        shipListDiv.innerHTML = ''; // Clear current list
        if (ships.length === 0) {
            shipListDiv.innerHTML = '<p>No ships in your hangar yet.</p>';
            return;
        }

        ships.forEach(ship => {
            const shipCard = document.createElement('article');
            const shipType = ship.type || 'Unknown type';
            
            let valueDisplay;
            let statusClass = '';
            if (ship.value > 0) {
                valueDisplay = `${ship.value.toLocaleString()} ISK`;
                statusClass = 'success';
            } else if (ship.value === 0 && ship.fitting) {
                valueDisplay = 'Price data unavailable';
                statusClass = 'warning';
            } else {
                valueDisplay = 'No fitting data';
                statusClass = 'error';
            }
            
            // Show parsed items if available
            let itemsDisplay = '';
            if (ship.fitting) {
                const { items } = parseFitting(ship.fitting);
                if (items && items.size > 0) {
                    itemsDisplay = '<p><strong>Items:</strong></p><ul>';
                    for (const [itemName, quantity] of items) {
                        itemsDisplay += `<li>${itemName} x${quantity}</li>`;
                    }
                    itemsDisplay += '</ul>';
                }
            }
            
            // Generate checklist HTML
            let checklistHTML = '<div class="checklist-section">';
            checklistHTML += '<h4>Pre-flight Checklist</h4>';
            checklistHTML += '<ul class="checklist" data-ship-id="' + ship.id + '">';
            
            if (ship.checklist && ship.checklist.length > 0) {
                ship.checklist.forEach((item, index) => {
                    checklistHTML += `<li>
                        <span class="checklist-item">${item}</span>
                        <button class="remove-checklist-item" data-ship-id="${ship.id}" data-index="${index}">×</button>
                    </li>`;
                });
            } else {
                checklistHTML += '<li class="empty-checklist">No checklist items yet.</li>';
            }
            
            checklistHTML += '</ul>';
            checklistHTML += '<div class="add-checklist-item">';
            checklistHTML += `<input type="text" class="checklist-input" data-ship-id="${ship.id}" placeholder="Add checklist item...">`;
            checklistHTML += `<button class="add-checklist-btn" data-ship-id="${ship.id}">Add</button>`;
            checklistHTML += '</div>';
            checklistHTML += '</div>';
            
            shipCard.innerHTML = `
                <header>
                    ${ship.name}
                    <div class="ship-actions">
                        <button class="edit-ship-btn" data-ship-id="${ship.id}">Edit</button>
                        <button class="delete-ship-btn" data-ship-id="${ship.id}">Delete</button>
                    </div>
                </header>
                <p><strong>Type:</strong> ${shipType}</p>
                <p><strong>Estimated Value:</strong> 
                    <span class="status-indicator ${statusClass}"></span>
                    ${valueDisplay}
                </p>
                ${itemsDisplay}
                ${checklistHTML}
                <details>
                    <summary>Fitting</summary>
                    <pre><code>${ship.fitting || 'No fitting provided.'}</code></pre>
                </details>
            `;
            shipListDiv.appendChild(shipCard);
        });
    }

    // --- Checklist Management ---
    async function addChecklistItem(shipId, item) {
        try {
            const ships = await getShips();
            const ship = ships.find(s => s.id === shipId);
            if (!ship) {
                throw new Error('Ship not found');
            }
            
            const newChecklist = [...(ship.checklist || []), item];
            await updateShip(shipId, { checklist: newChecklist });
            await renderShips();
        } catch (error) {
            console.error('Error adding checklist item:', error);
            alert('Error adding checklist item');
        }
    }

    async function removeChecklistItem(shipId, itemIndex) {
        try {
            const ships = await getShips();
            const ship = ships.find(s => s.id === shipId);
            if (!ship) {
                throw new Error('Ship not found');
            }
            
            const newChecklist = ship.checklist.filter((_, index) => index !== itemIndex);
            await updateShip(shipId, { checklist: newChecklist });
            await renderShips();
        } catch (error) {
            console.error('Error removing checklist item:', error);
            alert('Error removing checklist item');
        }
    }

    async function handleDeleteShip(shipId) {
        try {
            const ships = await getShips();
            const ship = ships.find(s => s.id === shipId);
            if (!ship) {
                throw new Error('Ship not found');
            }
            
            const confirmed = confirm(`Are you sure you want to delete "${ship.name}"? This action cannot be undone.`);
            if (!confirmed) {
                return;
            }
            
            await deleteShip(shipId);
            await renderShips();
            console.log(`Ship "${ship.name}" deleted successfully`);
        } catch (error) {
            console.error('Error deleting ship:', error);
            alert('Error deleting ship');
        }
    }

    async function handleEditShip(shipId) {
        try {
            const ships = await getShips();
            const ship = ships.find(s => s.id === shipId);
            if (!ship) {
                throw new Error('Ship not found');
            }
            
            const newName = prompt('Enter new ship name:', ship.name);
            if (newName === null) {
                return; // User cancelled
            }
            
            if (newName.trim() === '') {
                alert('Ship name cannot be empty');
                return;
            }
            
            const newFitting = prompt('Enter new fitting (optional):', ship.fitting || '');
            if (newFitting === null) {
                return; // User cancelled
            }
            
            // Show loading state
            const editBtn = document.querySelector(`button[data-ship-id="${shipId}"].edit-ship-btn`);
            const originalText = editBtn.textContent;
            editBtn.textContent = 'Updating...';
            editBtn.disabled = true;
            
            try {
                // Parse the new fitting if provided
                let updateData = { name: newName.trim() };
                
                if (newFitting.trim() !== ship.fitting) {
                    const { shipType, items } = parseFitting(newFitting);
                    const value = await calculateShipValue(items);
                    
                    updateData = {
                        ...updateData,
                        fitting: newFitting.trim(),
                        type: shipType,
                        value: value
                    };
                }
                
                await updateShip(shipId, updateData);
                await renderShips();
                console.log(`Ship "${ship.name}" updated successfully`);
            } catch (error) {
                console.error('Error updating ship:', error);
                alert('Error updating ship');
            } finally {
                // Reset button state if it still exists
                const currentEditBtn = document.querySelector(`button[data-ship-id="${shipId}"].edit-ship-btn`);
                if (currentEditBtn) {
                    currentEditBtn.textContent = originalText;
                    currentEditBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error editing ship:', error);
            alert('Error editing ship');
        }
    }

    // Event delegation for checklist management and ship actions
    shipListDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('add-checklist-btn')) {
            const shipId = parseInt(e.target.dataset.shipId);
            const input = e.target.parentElement.querySelector('.checklist-input');
            const item = input.value.trim();
            
            if (item) {
                await addChecklistItem(shipId, item);
                input.value = '';
            }
        }
        
        if (e.target.classList.contains('remove-checklist-item')) {
            const shipId = parseInt(e.target.dataset.shipId);
            const itemIndex = parseInt(e.target.dataset.index);
            await removeChecklistItem(shipId, itemIndex);
        }
        
        if (e.target.classList.contains('delete-ship-btn')) {
            const shipId = parseInt(e.target.dataset.shipId);
            await handleDeleteShip(shipId);
        }
        
        if (e.target.classList.contains('edit-ship-btn')) {
            const shipId = parseInt(e.target.dataset.shipId);
            await handleEditShip(shipId);
        }
    });

    // Handle Enter key in checklist input
    shipListDiv.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('checklist-input')) {
            const shipId = parseInt(e.target.dataset.shipId);
            const item = e.target.value.trim();
            
            if (item) {
                await addChecklistItem(shipId, item);
                e.target.value = '';
            }
        }
    });

    addShipForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shipName = document.getElementById('ship-name').value;
        const shipFitting = document.getElementById('ship-fitting').value;

        // Show loading state
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Calculating Value...';
        submitButton.disabled = true;

        try {
            // Parse the fitting to get ship type and items
            const { shipType, items } = parseFitting(shipFitting);
            console.log('Parsed fitting:', { shipType, items });
            
            // Calculate ship value using the API
            const value = await calculateShipValue(items);
            console.log('Calculated ship value:', value);

            const newShip = {
                name: shipName,
                type: shipType,
                fitting: shipFitting,
                value: value,
                checklist: [],
                isActive: false
            };

            await addShip(newShip);
            console.log("Ship added:", newShip);
            addShipForm.reset();
            await renderShips();
            
            // Show success message
            if (value > 0) {
                console.log(`Ship added successfully with value: ${value.toLocaleString()} ISK`);
            } else {
                console.log('Ship added successfully (price data unavailable)');
            }
            
        } catch (error) {
            console.error('Error adding ship:', error);
            alert('Error adding ship. Please check the console for details.');
        } finally {
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });

    // --- Missions Logic ---
    async function renderMissions() {
        const missions = await getMissions();
        missionListDiv.innerHTML = ''; // Clear current list
        if (missions.length === 0) {
            missionListDiv.innerHTML = '<p>No missions in your database yet.</p>';
            return;
        }

        missions.forEach(mission => {
            const missionCard = document.createElement('article');
            
            // Format rewards
            const iskReward = mission.baseIskReward ? mission.baseIskReward.toLocaleString() : '0';
            const bonusIskReward = mission.bonusIskReward ? mission.bonusIskReward.toLocaleString() : '0';
            const lpReward = mission.baseLpReward ? mission.baseLpReward.toLocaleString() : '0';
            
            // Format tags
            const tagsDisplay = mission.tags && mission.tags.length > 0 
                ? mission.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')
                : '<span class="muted">No tags</span>';
            
            missionCard.innerHTML = `
                <header>
                    ${mission.name}
                    <div class="mission-actions">
                        <button class="edit-mission-btn" data-mission-id="${mission.id}">Edit</button>
                        <button class="delete-mission-btn" data-mission-id="${mission.id}">Delete</button>
                    </div>
                </header>
                <div class="mission-details">
                    <div class="mission-meta">
                        <p><strong>Level:</strong> ${mission.level}</p>
                        <p><strong>Enemy Faction:</strong> ${mission.enemyFaction || 'Unknown'}</p>
                        <p><strong>Damage to Deal:</strong> ${mission.damageToDeal || 'Unknown'}</p>
                        <p><strong>Damage to Resist:</strong> ${mission.damageToResist || 'Unknown'}</p>
                    </div>
                    <div class="mission-rewards">
                        <p><strong>ISK Reward:</strong> ${iskReward} ISK</p>
                        <p><strong>Bonus ISK Reward:</strong> ${bonusIskReward} ISK</p>
                        <p><strong>LP Reward:</strong> ${lpReward} LP</p>
                    </div>
                    <div class="mission-tags">
                        <p><strong>Tags:</strong> ${tagsDisplay}</p>
                    </div>
                    ${mission.notes ? `<div class="mission-notes">
                        <p><strong>Notes:</strong></p>
                        <p class="notes-text">${mission.notes}</p>
                    </div>` : ''}
                </div>
            `;
            missionListDiv.appendChild(missionCard);
        });
    }

    async function handleDeleteMission(missionId) {
        try {
            const missions = await getMissions();
            const mission = missions.find(m => m.id === missionId);
            if (!mission) {
                throw new Error('Mission not found');
            }
            
            const confirmed = confirm(`Are you sure you want to delete "${mission.name}"? This action cannot be undone.`);
            if (!confirmed) {
                return;
            }
            
            await deleteMission(missionId);
            await renderMissions();
            console.log(`Mission "${mission.name}" deleted successfully`);
        } catch (error) {
            console.error('Error deleting mission:', error);
            alert('Error deleting mission');
        }
    }

    async function handleEditMission(missionId) {
        try {
            const missions = await getMissions();
            const mission = missions.find(m => m.id === missionId);
            if (!mission) {
                throw new Error('Mission not found');
            }
            
            // Populate form with existing data
            document.getElementById('mission-name').value = mission.name || '';
            document.getElementById('mission-level').value = mission.level || 1;
            document.getElementById('mission-enemy-faction').value = mission.enemyFaction || '';
            document.getElementById('mission-damage-to-deal').value = mission.damageToDeal || '';
            document.getElementById('mission-damage-to-resist').value = mission.damageToResist || '';
            document.getElementById('mission-base-isk-reward').value = mission.baseIskReward || '';
            document.getElementById('mission-bonus-isk-reward').value = mission.bonusIskReward || '';
            document.getElementById('mission-base-lp-reward').value = mission.baseLpReward || '';
            document.getElementById('mission-notes').value = mission.notes || '';
            
            // Clear all tag checkboxes first
            const tagCheckboxes = document.querySelectorAll('#mission-tags input[type="checkbox"]');
            tagCheckboxes.forEach(checkbox => checkbox.checked = false);
            
            // Set checked state for existing tags
            if (mission.tags && mission.tags.length > 0) {
                mission.tags.forEach(tag => {
                    const checkbox = document.querySelector(`#mission-tags input[value="${tag}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // Change form button to update mode
            const submitButton = addMissionForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Update Mission';
            
            // Store the mission ID for update
            addMissionForm.dataset.editingMissionId = missionId;
            
            // Focus on the form
            document.getElementById('mission-name').focus();
            
            console.log(`Editing mission: ${mission.name}`);
        } catch (error) {
            console.error('Error editing mission:', error);
            alert('Error editing mission');
        }
    }

    // Event delegation for mission actions
    missionListDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-mission-btn')) {
            const missionId = parseInt(e.target.dataset.missionId);
            await handleDeleteMission(missionId);
        }
        
        if (e.target.classList.contains('edit-mission-btn')) {
            const missionId = parseInt(e.target.dataset.missionId);
            await handleEditMission(missionId);
        }
    });

    addMissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const missionName = document.getElementById('mission-name').value;
        const missionLevel = parseInt(document.getElementById('mission-level').value);
        const enemyFaction = document.getElementById('mission-enemy-faction').value;
        const damageToDeal = document.getElementById('mission-damage-to-deal').value;
        const damageToResist = document.getElementById('mission-damage-to-resist').value;
        const baseIskReward = parseInt(document.getElementById('mission-base-isk-reward').value) || 0;
        const bonusIskReward = parseInt(document.getElementById('mission-bonus-isk-reward').value) || 0;
        const baseLpReward = parseInt(document.getElementById('mission-base-lp-reward').value) || 0;
        const notes = document.getElementById('mission-notes').value;
        
        // Parse tags from checkboxes
        const tagCheckboxes = document.querySelectorAll('#mission-tags input[type="checkbox"]:checked');
        const tags = Array.from(tagCheckboxes).map(checkbox => checkbox.value);

        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;

        try {
            const missionData = {
                name: missionName,
                level: missionLevel,
                enemyFaction: enemyFaction,
                damageToDeal: damageToDeal,
                damageToResist: damageToResist,
                baseIskReward: baseIskReward,
                bonusIskReward: bonusIskReward,
                baseLpReward: baseLpReward,
                tags: tags,
                notes: notes
            };

            const editingMissionId = addMissionForm.dataset.editingMissionId;
            
            if (editingMissionId) {
                // Update existing mission
                submitButton.textContent = 'Updating...';
                await updateMission(parseInt(editingMissionId), missionData);
                console.log("Mission updated:", missionData);
                
                // Reset form to add mode
                delete addMissionForm.dataset.editingMissionId;
            } else {
                // Add new mission
                submitButton.textContent = 'Adding...';
                await addMission(missionData);
                console.log("Mission added:", missionData);
            }
            
            addMissionForm.reset();
            
            // Clear all tag checkboxes after form reset
            const tagCheckboxes = document.querySelectorAll('#mission-tags input[type="checkbox"]');
            tagCheckboxes.forEach(checkbox => checkbox.checked = false);
            
            await renderMissions();
            
        } catch (error) {
            console.error('Error saving mission:', error);
            alert('Error saving mission. Please check the console for details.');
        } finally {
            submitButton.disabled = false;
            if (!addMissionForm.dataset.editingMissionId) {
                submitButton.textContent = originalText;
            }
        }
    });

    // Set hangar as default view for now
    document.querySelector('[data-section="hangar-section"]').click();
});