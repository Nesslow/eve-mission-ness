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
            
            shipCard.innerHTML = `
                <header>${ship.name}</header>
                <p><strong>Type:</strong> ${shipType}</p>
                <p><strong>Estimated Value:</strong> 
                    <span class="status-indicator ${statusClass}"></span>
                    ${valueDisplay}
                </p>
                ${itemsDisplay}
                <details>
                    <summary>Fitting</summary>
                    <pre><code>${ship.fitting || 'No fitting provided.'}</code></pre>
                </details>
            `;
            shipListDiv.appendChild(shipCard);
        });
    }

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