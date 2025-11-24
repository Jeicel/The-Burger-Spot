// Menu functions
function loadMenuItems(selectedCategory = 'all') {
    const menuContainer = document.getElementById('menu-items');
    if (!menuContainer) return;

    // Clear the container
    menuContainer.innerHTML = '';

    // Category ordering and labels
    const categoryOrder = ['house-burgers', 'sides-addons', 'drinks-shakes', 'desserts'];
    const categoryLabels = {
        'house-burgers': '🍔 House Burgers',
        'sides-addons': '🍟 Sides & Add-Ons',
        'drinks-shakes': '🥤 Drinks & Shakes',
        'desserts': '🍰 Desserts',
        'other': 'Other Items'
    };

    // Normalize categories with aliases (treat legacy names consistently)
    const aliasMap = {
        'burgers': 'house-burgers',
        'house burgers': 'house-burgers',
        'house-burger': 'house-burgers',
        'burger': 'house-burgers',
        'sides': 'sides-addons',
        'add-ons': 'sides-addons',
        'addons': 'sides-addons',
        'sides & add-ons': 'sides-addons',
        'drinks': 'drinks-shakes',
        'shakes': 'drinks-shakes',
        'drinks & shakes': 'drinks-shakes',
        'dessert': 'desserts'
    };

    const items = database.menuItems.map(it => {
        const raw = (it.category || 'other').toString().toLowerCase().trim();
        const normalized = aliasMap[raw] || raw;
        return {
            ...it,
            category: normalized
        };
    });

    // Group items by category
    const grouped = items.reduce((acc, it) => {
        const cat = it.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(it);
        return acc;
    }, {});

    // Build the rendering order: known categories first, then any extras
    const extraCategories = Object.keys(grouped).filter(c => !categoryOrder.includes(c));
    let renderCategories = [...categoryOrder, ...extraCategories];

    // If a specific category is selected, only render that one
    if (selectedCategory && selectedCategory !== 'all') {
        if (grouped[selectedCategory]) {
            renderCategories = [selectedCategory];
        } else {
            // Nothing to render for this category
            renderCategories = [];
        }
    }

    // If we have nothing to show (e.g., due to persisted old categories), render a friendly empty state
    if (renderCategories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
            <h3>No items in this category</h3>
            <p>Try another category or show the full menu.</p>
            <button class="btn" id="show-all-btn">Show All</button>
        `;
        menuContainer.appendChild(empty);
        const resetBtn = empty.querySelector('#show-all-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Update active state on the buttons
                const buttons = document.querySelectorAll('.category-filter-btn');
                buttons.forEach(b => b.classList.remove('active'));
                const allBtn = document.querySelector('.category-filter-btn[data-category="all"]');
                if (allBtn) allBtn.classList.add('active');
                loadMenuItems('all');
            });
        }
        return; // stop here
    }

    renderCategories.forEach(cat => {
        let catItems = grouped[cat];
        if (!catItems || catItems.length === 0) return;

        // Create category section
        const section = document.createElement('section');
        section.className = 'menu-category';

        const header = document.createElement('h3');
        header.className = 'menu-category-title';
        header.textContent = categoryLabels[cat] || cat;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'menu-category-grid';

        // Render featured items first if any are marked with `featured: true`
        try {
            catItems = catItems.slice().sort((a, b) => Number(b.featured === true) - Number(a.featured === true));
        } catch (e) {
            // if sorting fails, fall back to original order
        }

        catItems.forEach(item => {
            const el = createMenuItemElement(item);
            grid.appendChild(el);
        });

        section.appendChild(grid);
        menuContainer.appendChild(section);
    });
}

function setupCategoryFilters() {
    const buttons = document.querySelectorAll('.category-filter-btn');
    if (!buttons || buttons.length === 0) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-category') || 'all';
            // set active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // render
            loadMenuItems(cat);
        });
    });
}

function loadFeaturedItems() {
    const featuredContainer = document.getElementById('featured-items');
    if (!featuredContainer) return;
    
    featuredContainer.innerHTML = '';
    
    // Show first 3 items as featured
    const featuredItems = database.menuItems.slice(0, 3);
    featuredItems.forEach(item => {
        const menuItemElement = createMenuItemElement(item);
        featuredContainer.appendChild(menuItemElement);
    });
}

function createMenuItemElement(item) {
    const div = document.createElement('div');
    // Add a featured class when the data marks this item as featured
    div.className = 'menu-item' + (item.featured ? ' featured' : '');
    
    // Check if user is a customer or guest to show add to cart button
    const showAddToCart = !currentUser || currentUser.role === 'customer';
    
    // Check if item has flavors
    const hasFlavors = item.flavors && item.flavors.length > 0;
    
    div.innerHTML = `
        <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'">
        <div class="menu-item-content">
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            ${hasFlavors && showAddToCart ? `
                <div style="margin: 10px 0;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: #ddd;">Choose Flavor:</label>
                    <select class="flavor-select" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: #fff; font-size: 0.9rem;">
                        ${item.flavors.map(flavor => `<option value="${flavor}">${flavor}</option>`).join('')}
                    </select>
                </div>
            ` : ''}
            <div class="menu-item-price">
                <span class="price">${formatCurrency(item.price)}</span>
                ${showAddToCart ? `<button class="add-to-cart" data-id="${item.id}">Add to Cart</button>` : ''}
            </div>
        </div>
    `;
    
    // Add event listener to the add to cart button if it exists
    if (showAddToCart) {
        const addToCartBtn = div.querySelector('.add-to-cart');
        addToCartBtn.addEventListener('click', function() {
            // If item has flavors, get the selected flavor
            if (hasFlavors) {
                const flavorSelect = div.querySelector('.flavor-select');
                const selectedFlavor = flavorSelect.value;
                addToCart(item, selectedFlavor);
            } else {
                addToCart(item);
            }
        });
    }
    
    return div;
}

function addToCart(item, flavor = null) {
    // Check if user is logged in - require login to add to cart
    if (!currentUser) {
        showNotification('Please login to add items to cart', 'error');
        // Redirect to login page with return URL
        setTimeout(() => {
            window.location.href = 'login.html?redirect=menu.html';
        }, 1500);
        return;
    }
    
    // For logged-in customers
    if (currentUser.role !== 'customer') {
        showNotification('Please login as a customer to add items to cart', 'error');
        return;
    }
    
    // For items with flavors, check if same item with same flavor exists
    const existingItem = cart.find(cartItem => {
        if (flavor) {
            return cartItem.id === item.id && cartItem.flavor === flavor;
        }
        return cartItem.id === item.id;
    });
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        const cartItem = {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1
        };
        
        // Add flavor if provided
        if (flavor) {
            cartItem.flavor = flavor;
            cartItem.name = `${item.name} (${flavor})`;
        }
        
        cart.push(cartItem);
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`${item.name}${flavor ? ' (' + flavor + ')' : ''} added to cart`);
}

// Initialize menu on page load
document.addEventListener('DOMContentLoaded', function() {
    // Wire category filter buttons and initial render
    try { setupCategoryFilters(); } catch (e) { console.warn('setupCategoryFilters failed', e); }

    // Allow selecting initial category via URL (?category=house-burgers)
    let initialCategory = 'all';
    try {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = (params.get('category') || '').trim();
        if (fromUrl) {
            initialCategory = fromUrl;
            // Reflect active state in buttons if present
            const buttons = document.querySelectorAll('.category-filter-btn');
            buttons.forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.category-filter-btn[data-category="${initialCategory}"]`) || document.querySelector('.category-filter-btn[data-category="all"]');
            if (btn) btn.classList.add('active');
        }
    } catch (e) {
        console.warn('Error reading initial category from URL', e);
    }

    try { loadMenuItems(initialCategory); } catch (e) { console.warn('loadMenuItems failed', e); }
    // Add to cart buttons are set up in createMenuItemElement
});