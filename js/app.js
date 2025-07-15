// Main application logic
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. Initializing app.");

    await initDB(); // Initialize the database

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('#main-content section');
    const addShipForm = document.getElementById('add-ship-form');
    const shipListDiv = document.getElementById('ship-list');
    
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
            
            // Show hangar by default for now
            if (targetId === 'hangar-section') {
                renderShips();
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

    // Set hangar as default view for now
    document.querySelector('[data-section="hangar-section"]').click();
});