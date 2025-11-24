// Global variables
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Database simulation
const database = {
    // Start with an empty users array to avoid seeded demo accounts in production
    users: [],
    // Load orders from localStorage or use sample orders
    orders: JSON.parse(localStorage.getItem('orders')) || [
        {
            id: "ORD73794",
            userId: 1,
            items: [
                { id: 1, name: "Classic Cheeseburger", quantity: 2, price: 8.99 }
            ],
            total: 17.98,
            status: "Preparing",
            date: "2025-10-23"
        },
        {
            id: "ORD12345",
            customer: "John Customer",
            customerEmail: "customer@The Burger .com",
            items: [
                { id: 1, name: "Classic Cheeseburger", price: 8.99, quantity: 2 },
                { id: 6, name: "BBQ Ranch Burger", price: 10.49, quantity: 1 }
            ],
            total: 28.47,
            status: "preparing",
            deliveryTime: "30-40 minutes",
            timestamp: new Date('2025-12-01').getTime()
        }
    ],
    menuItems: [
        //  House Burgers
        {
            id: 1,
            name: "Classic Grill Burger",
            description: "Juicy grilled beef patty, cheddar cheese, lettuce, tomato, onion, and our signature sauce on a toasted brioche bun.",
            price: 119,
            category: "house-burgers",
           image: "images/classic-grill-burger.png"
        },
        {
            id: 2,
            name: "Bacon Supreme",
            description: "Double-smoked bacon, melted American cheese, and crispy onions topped with BBQ glaze.",
            price: 139,
            category: "house-burgers",
            image: "images/bacon-supreme.png"
        },
        {
            id: 3,
            name: "Mushroom Swiss Melt",
            description: "Tender beef patty layered with sautéed mushrooms, Swiss cheese, and garlic aioli.",
            price: 129,
            category: "house-burgers",
            image: "images/mushroom-swiss-melt.png"
        },
        {
            id: 4,
            name: "The Spicy Inferno",
            description: "Jalapeños, pepper jack cheese, chili flakes, and fiery mayo for heat lovers.",
            price: 129,
            category: "house-burgers",
            image: "images/the-spicy-inferno.png"
        },
        {
            id: 5,
            name: "The Veggie Stack",
            description: "Plant-based patty, fresh greens, grilled tomato, and avocado dressing.",
            price: 109,
            category: "house-burgers",
            image: "images/the-veggie-stack.png"
        },

        // 🍟 Sides & Add-Ons
        {
            id: 6,
            name: "Crispy Fries",
            description: "Golden, crispy fries — the perfect side.",
            price: 59,
            category: "sides-addons",
            image: "images/crispy-fries.png"
        },
        {
            id: 7,
            name: "Cheesy Bacon Fries",
            description: "Crispy fries loaded with cheese and smoky bacon bits.",
            price: 89,
            category: "sides-addons",
            image: "images/cheesy-bacon-fries.png"
        },
        {
            id: 8,
            name: "Onion Rings",
            description: "Crispy battered onion rings with dip.",
            price: 69,
            category: "sides-addons",
            image: "images/onion-rings.png"
        },
        {
            id: 9,
            name: "Chicken Wings (6 pcs)",
            description: "Flavor-packed wings — perfect for sharing.",
            price: 149,
            category: "sides-addons",
            image: "images/chicken-wings.png"
        },
        {
            id: 10,
            name: "Extra Patty",
            description: "Add an extra patty to any burger.",
            price: 60,
            category: "sides-addons",
            image: "images/extra-patty.png"
        },
        {
            id: 11,
            name: "Extra Cheese",
            description: "Make it extra cheesy.",
            price: 25,
            category: "sides-addons",
            image: "images/extra-cheese.png"
        },

        // 🥤 Drinks & Shakes
        {
            id: 12,
            name: "Iced Tea / Lemonade",
            description: "Refreshing and chilled.",
            price: 49,
            category: "drinks-shakes",
            image: "images/iced-tea-lemonade.png"
        },
        {
            id: 13,
            name: "Soft Drinks",
            description: "Assorted sodas.",
            price: 45,
            category: "drinks-shakes",
            image: "images/soft-drinks.png",
            flavors: ["Coke", "Sprite", "Royal",]
        },
        {
            id: 14,
            name: "Bottled Water",
            description: "Pure and simple hydration.",
            price: 35,
            category: "drinks-shakes",
            image: "images/bottled-water.png"
        },
        {
            id: 15,
            name: "Milkshakes",
            description: "Chocolate, Vanilla, Strawberry, Cookies & Cream.",
            price: 99,
            category: "drinks-shakes",
            image: "images/milkshakes.png",
            flavors: ["Chocolate", "Vanilla", "Strawberry", "Cookies & Cream"]
        },

        // 🍰 Desserts
        {
            id: 16,
            name: "Choco Lava Cake",
            description: "Warm chocolate cake with a gooey center.",
            price: 89,
            category: "desserts",
            image: "images/choco-lava-cake.png"
        },
        {
            id: 17,
            name: "Classic Sundae",
            description: "Soft-serve sundae with classic toppings.",
            price: 79,
            category: "desserts",
            image: "images/classic-sundae.png"
        },
        {
            id: 18,
            name: "Mini Cheesecake",
            description: "Creamy cheesecake in a perfect mini size.",
            price: 99,
            category: "desserts",
            image: "images/mini-cheesecake.png"
        }
    ],
};

// Load persisted menu items if present (so admin edits survive reload)
try {
    const persistedMenu = localStorage.getItem('menuItems');
    if (persistedMenu) {
        const parsed = JSON.parse(persistedMenu);
        if (Array.isArray(parsed) && parsed.length > 0) {
            database.menuItems = parsed;
        }
    }
} catch (e) {
    console.warn('Could not load persisted menu items', e);
}

// Utility functions
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = 'notification';
    
    if (type === 'error') {
        notification.classList.add('error');
    } else {
        notification.classList.remove('error');
    }
    
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Prevent blocking native alerts in the app; show a non-blocking notification instead
// This helps avoid unexpected browser alert() dialogs during admin flows.
window.alert = function(msg) {
    try {
        showNotification(String(msg), 'error');
    } catch (e) {
        console.warn('alert intercepted:', msg);
    }
};

// Format numbers as Philippine pesos (local format)
// Usage: formatCurrency(1234.5) -> "₱1,234.50"
function formatCurrency(value) {
    const n = Number(value) || 0;
    try {
        return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
    } catch (e) {
        // Fallback: simple formatting with thousands separator
        const fixed = n.toFixed(2);
        return '₱' + fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', function() {
    // Try to load external users.json (useful for deployments where you want to seed accounts)
    (async function tryLoadExternalUsers() {
        async function loadExternalUsers() {
            try {
                const res = await fetch('data/users.json', { cache: 'no-store' });
                if (!res.ok) throw new Error('No external users.json');
                const external = await res.json();
                if (!Array.isArray(external)) return;
                // Merge without duplicating by normalized email
                external.forEach(u => {
                    const email = (u.email || '').trim().toLowerCase();
                    const exists = database.users.some(d => (d.email || '').trim().toLowerCase() === email);
                    if (!exists) database.users.push({ ...u, email });
                });
                console.log('Loaded external users.json');
            } catch (e) {
                // Not fatal — continue with built-in users
                // console.info('No external users.json found or failed to load');
            }
        }

        await loadExternalUsers();
    })();
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    // Always update UI based on current user state (logged in or not)
    updateUIForUser();

    // Load persisted users if present
    try {
        const persistedUsers = localStorage.getItem('users');
        if (persistedUsers) {
            const parsedUsers = JSON.parse(persistedUsers);
            if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
                // Purge any known demo/test accounts (leftover from previous deploys) for safety
                const bannedEmails = [
                    'admin@grillspot.com', 'staff@grillspot.com', 'customer@grillspot.com',
                    'admin@theburger.com', 'staff@theburger.com', 'customer@theburger.com'
                ];

                const filtered = parsedUsers.filter(u => {
                    const e = (u.email || '').trim().toLowerCase();
                    return !bannedEmails.includes(e);
                });

                // Merge persisted users with any users already loaded (e.g., from external data/users.json)
                const merged = Array.isArray(database.users) ? [...database.users] : [];
                parsedUsers.forEach(u => {
                    const email = (u.email || '').trim().toLowerCase();
                    if (bannedEmails.includes(email)) return; // skip banned/demo accounts
                    const exists = merged.some(m => (m.email || '').trim().toLowerCase() === email);
                    if (!exists) merged.push({ ...u, email });
                });
                database.users = merged;

                // If we removed any banned accounts from the persisted list, persist the cleaned list back
                const cleaned = parsedUsers.filter(u => !bannedEmails.includes((u.email||'').trim().toLowerCase()));
                if (cleaned.length !== parsedUsers.length) {
                    try {
                        localStorage.setItem('users', JSON.stringify(cleaned));
                    } catch (e) { /* ignore storage write errors */ }
                    // If currentUser is a banned account, remove it as well
                    try {
                        const cu = JSON.parse(localStorage.getItem('currentUser') || 'null');
                        if (cu && bannedEmails.includes((cu.email||'').trim().toLowerCase())) {
                            localStorage.removeItem('currentUser');
                            currentUser = null;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Could not load persisted users', e);
    }
    
    // Update cart count in navigation if element exists
    // Seed two months of demo sales (runs once unless forced via URL param)
    try { seedTwoMonthsSales(); } catch (e) { /* ignore */ }
    updateCartCount();

    // Setup mobile navigation toggle
    setupMobileNav();
});

// Update UI based on user role
function updateUIForUser() {
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const loginLink = document.getElementById('login-link');
    const heroLoginBtn = document.getElementById('hero-login-btn');
    const customerOnlyElements = document.querySelectorAll('.customer-only');
    const staffAdminOnlyLinks = document.querySelectorAll('.staff-admin-only');
    const guestCartNotice = document.getElementById('guest-cart-notice');
    const guestTrackNotice = document.getElementById('guest-track-notice');

    // Always ensure user-info starts hidden to prevent flash
    if (userInfo && !userInfo.classList.contains('hidden')) {
        userInfo.classList.add('hidden');
    }
    
    if (currentUser) {
        // Show user info and hide login link
        if (userInfo) userInfo.classList.remove('hidden');
        if (loginLink) loginLink.classList.add('hidden');
        if (heroLoginBtn) heroLoginBtn.style.display = 'none';
        
        // Update user info
        if (userName) userName.textContent = currentUser.name;
        if (userRole) userRole.textContent = currentUser.role;
        
        // Show/hide navigation based on role
        if (currentUser.role === 'customer') {
            customerOnlyElements.forEach(el => el.classList.remove('hidden'));
            staffAdminOnlyLinks.forEach(link => link.classList.add('hidden'));
            if (guestCartNotice) guestCartNotice.classList.add('hidden');
            if (guestTrackNotice) guestTrackNotice.classList.add('hidden');
        } else if (currentUser.role === 'staff' || currentUser.role === 'admin') {
            customerOnlyElements.forEach(el => el.classList.add('hidden'));
            staffAdminOnlyLinks.forEach(link => link.classList.remove('hidden'));
        }
    } else {
        // Hide user info and show login link
        if (userInfo) userInfo.classList.add('hidden');
        if (loginLink) loginLink.classList.remove('hidden');
        if (heroLoginBtn) heroLoginBtn.style.display = 'inline-block';
        
        // Hide all role-specific navigation, leaving only Home, Menu, and Login visible
        customerOnlyElements.forEach(el => el.classList.add('hidden'));
        staffAdminOnlyLinks.forEach(link => link.classList.add('hidden'));
        
        // Show guest notices if they exist
        if (guestCartNotice) guestCartNotice.classList.remove('hidden');
        if (guestTrackNotice) guestTrackNotice.classList.remove('hidden');
    }
    }

// Order tracking functionality
document.addEventListener('DOMContentLoaded', function() {
    const trackBtn = document.getElementById('track-btn');
    const orderIdInput = document.getElementById('order-id');
    
    if (trackBtn) {
        trackBtn.addEventListener('click', function() {
            const orderId = orderIdInput.value.trim();
            if (!orderId) {
                showNotification('Please enter an order ID', 'error');
                return;
            }

            const order = findOrder(orderId);
            if (order) {
                displayOrderStatus(order);
            } else {
                showNotification('Order not found. Please check the order ID and try again.', 'error');
            }
        });
    }
});

function findOrder(orderId) {
    // First check in-memory database.orders
    if (Array.isArray(database.orders)) {
        const found = database.orders.find(order => order.id === orderId);
        if (found) return found;
    }

    // Fallback: check orders saved in localStorage (useful when there's no backend)
    try {
        const ls = localStorage.getItem('orders');
        if (ls) {
            const localOrders = JSON.parse(ls);
            if (Array.isArray(localOrders)) {
                return localOrders.find(o => o.id === orderId) || null;
            }
        }
    } catch (e) {
        console.warn('Could not read orders from localStorage', e);
    }

    return null;
}

function displayOrderStatus(order) {
    const statusDisplay = document.querySelector('.order-tracking-result');
    if (!statusDisplay) {
        const container = document.querySelector('.order-status');
        const statusDiv = document.createElement('div');
        statusDiv.className = 'order-tracking-result';
        container.appendChild(statusDiv);
    }

    const statusHTML = `
        <div class="order-details">
            <h3>Order #${order.id}</h3>
            <div class="order-info">
                <p><strong>Status:</strong> ${order.status}</p>
                <p><strong>Date:</strong> ${order.date}</p>
                <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
            </div>
            <div class="order-items">
                <h4>Items:</h4>
                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${item.name}</span>
                        <span>x${item.quantity}</span>
                        <span>${formatCurrency(item.price * item.quantity)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const resultDiv = document.querySelector('.order-tracking-result');
    resultDiv.innerHTML = statusHTML;
    resultDiv.style.display = 'block';
}

// Update cart count in navigation
function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems > 0 ? `(${totalItems})` : '';
    }
}

// Mobile navigation (hamburger) setup
function setupMobileNav() {
    const header = document.querySelector('header');
    if (!header) return;

    // Find or create the toggle button
    let toggleBtn = header.querySelector('.nav-toggle');
    const headerContent = header.querySelector('.header-content') || header;

    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.className = 'nav-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle menu');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '<span class="bar"></span><span class="bar"></span><span class="bar"></span>';

        // Insert as first child for visibility across layouts
        if (headerContent.firstChild) {
            headerContent.insertBefore(toggleBtn, headerContent.firstChild);
        } else {
            headerContent.appendChild(toggleBtn);
        }
    }

    const nav = header.querySelector('nav');
    const navList = nav ? nav.querySelector('ul') : null;
    if (!nav || !navList) return;

    // Toggle open/close
    function toggleMenu(force) {
        const open = typeof force === 'boolean' ? force : !header.classList.contains('mobile-nav-open');
        header.classList.toggle('mobile-nav-open', open);
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggleBtn.addEventListener('click', () => toggleMenu());

    // Close when clicking a nav link (on mobile)
    navList.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                toggleMenu(false);
            }
        });
    });

    // Reset state on resize upwards
    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 768px)').matches) {
            toggleMenu(false);
        }
    });
}