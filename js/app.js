// Main application logic
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded and parsed. Initializing app.");

    await initDB(); // Initialize the database

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('#main-content section');
    const addShipForm = document.getElementById('add-ship-form');
    const shipListDiv = document.getElementById('ship-list');

    // --- Navigation ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');

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
            shipCard.innerHTML = `
                <header>${ship.name}</header>
                <p><strong>Fitting:</strong></p>
                <pre><code>${ship.fitting || 'No fitting provided.'}</code></pre>
            `;
            shipListDiv.appendChild(shipCard);
        });
    }

    addShipForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const shipName = document.getElementById('ship-name').value;
        const shipFitting = document.getElementById('ship-fitting').value;

        const newShip = {
            name: shipName,
            fitting: shipFitting,
            // Other fields will be added later
        };

        await addShip(newShip);
        console.log("Ship added:", newShip);
        addShipForm.reset();
        await renderShips();
    });

    // Set hangar as default view for now
    document.querySelector('[data-section="hangar-section"]').click();
});