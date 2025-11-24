// Cart functions
function updateCartDisplay() {
    const cartContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartContainer) return;
    
    cartContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-state">
                <i>🛒</i>
                <h3>Your cart is empty</h3>
                <p>Add some delicious burgers to get started!</p>
            </div>
        `;
    if (cartTotalElement) cartTotalElement.textContent = 'Total: ' + formatCurrency(0);
        return;
    }
    
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${formatCurrency(item.price)}</p>
            </div>
            <div class="cart-item-controls">
                <button class="quantity-btn minus" data-id="${item.id}">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn plus" data-id="${item.id}">+</button>
                <button class="remove-item" data-id="${item.id}">Remove</button>
            </div>
        `;
        
        cartContainer.appendChild(cartItemElement);
    });
    
    // Add event listeners to quantity buttons
    document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            updateQuantity(id, -1);
        });
    });
    
    document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            updateQuantity(id, 1);
        });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.getAttribute('data-id'));
            removeFromCart(id);
        });
    });
    
    if (cartTotalElement) cartTotalElement.textContent = `Total: ${formatCurrency(total)}`;
    updateCartCount();
}

// Lazy-load Tesseract.js (v2) from CDN and run OCR on a data URL. Returns extracted text.
function loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (window.__tesseractLoading) return window.__tesseractLoading;

    window.__tesseractLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js';
        s.async = true;
        s.onload = () => {
            if (window.Tesseract) resolve(window.Tesseract);
            else reject(new Error('Tesseract failed to load'));
        };
        s.onerror = (e) => reject(new Error('Could not load OCR library'));
        document.head.appendChild(s);
    });

    return window.__tesseractLoading;
}

async function runOcrOnDataUrl(dataUrl) {
    try {
        await loadTesseractScript();
        // Tesseract v2: Tesseract.recognize(image, lang)
        const result = await window.Tesseract.recognize(dataUrl, 'eng');
        return (result && result.data && result.data.text) ? result.data.text : '';
    } catch (e) {
        console.warn('OCR failed', e);
        throw e;
    }
}

function updateQuantity(id, change) {
    const item = cart.find(item => item.id === id);
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeFromCart(id);
        } else {
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartDisplay();
        }
    }
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartDisplay();
    showNotification('Item removed from cart');
}

function loadCheckoutItems() {
    const checkoutContainer = document.getElementById('checkout-items');
    const checkoutTotalElement = document.getElementById('checkout-total');
    
    if (!checkoutContainer) return;
    
    checkoutContainer.innerHTML = '';
    
    if (cart.length === 0) {
    checkoutContainer.innerHTML = '<p>Your cart is empty</p>';
    if (checkoutTotalElement) checkoutTotalElement.textContent = 'Total: ' + formatCurrency(0);
        return;
    }
    
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'checkout-item';
        itemElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>${item.quantity}x ${item.name}</span>
                <span>${formatCurrency(itemTotal)}</span>
            </div>
        `;
        checkoutContainer.appendChild(itemElement);
    });
    
    if (checkoutTotalElement) checkoutTotalElement.textContent = `Total: ${formatCurrency(total)}`;

    // Update subtotal/shipping/grand total display (shipping depends on city/zip inputs)
    try { updateCheckoutTotals(); } catch (e) { /* non-fatal */ }
}

// Compute shipping fee based on location (city and/or ZIP). Adjust rules as needed.
function computeShippingFee({city = '', zip = '', barangay = '', subtotal = 0} = {}) {
    // If location missing, return null to indicate unknown
    if (!city && !zip && !barangay) return null;

    const c = (city || '').toString().trim().toLowerCase();
    const z = (zip || '').toString().trim();
    const b = (barangay || '').toString().trim().toLowerCase();

    // Per-barangay fees for Mabini (keeps previous granular behavior)
    // These defaults will be overridden if SHIPPING_FEES is loaded
    let mabiniFees = {
        'poblacion': 30,
        'san isidro': 40,
        'san roque': 40,
        'san jose': 40,
        'tambong': 40
    };

    // Exact municipality/postal mapping derived from provided table
    // Values can be a number (flat fee) or an object { fee, freeOver }
    let postalFeeMap = {
        '4202': 30,
        '4211': 40,
        '4205': 40,
        '4201': 40,
        '4209': 40,
        '4210': 40,
        '4204': 40,
        '4206': 40,
        '4208': 40,
        '4213': 50,
        '4219': 50,
        '4212': 50,
        '4222': 50,
        '4218': 50,
        '4223': 50,
        '4200': 60,
        '4230': 60,
        '4217': 60,
        '4233': { fee: 60, freeOver: 5000 },
        '4224': 60,
        '4225': 60,
        '4227': 60,
        '4234': { fee: 60, freeOver: 5000 },
        '4232': { fee: 60, freeOver: 5000 },
        '4215': 70,
        '4221': 70,
        '4216': 70,
        '4229': 70,
        '4226': 80,
        '4231': 80
    };

    // Municipality name mapping (lowercase keys) — matching will be exact equality
    let municipalityMap = {
        'mabini': 30,
        'agoncillo': 40,
        'alitagtag': 40,
        'bauan': 40,
        'lemery': 40,
        'san luis': 40,
        'san pascual': 40,
        'sta. teresita': 40,
        'sta teresita': 40,
        'taal': 40,
        'balayan': 50,
        'balete': 50,
        'calaca': 50,
        'cuenca': 50,
        'fernando airbase': 50,
        'mataas na kahoy': 50,
        'batangas city': 60,
        'ibaan': 60,
        'lipa': 60,
        'lipa city': 60,
        'malvar': { fee: 60, freeOver: 5000 },
        'padre garcia': 60,
        'rosario': 60,
        'san jose': 60,
        'sto. tomas': { fee: 60, freeOver: 5000 },
        'sto tomas': { fee: 60, freeOver: 5000 },
        'tanauan': { fee: 60, freeOver: 5000 },
        'calatagan': 70,
        'laurel': 70,
        'lian': 70,
        'lobo': 70,
        'san juan': 80,
        'nasugbu': 80
    };

    // If the external JSON loaded, override defaults with its content
    if (SHIPPING_FEES) {
        mabiniFees = SHIPPING_FEES.mabiniBarangays || mabiniFees;
        postalFeeMap = SHIPPING_FEES.postal || postalFeeMap;
        municipalityMap = SHIPPING_FEES.municipality || municipalityMap;
    }

    // Debug: log call inputs
    try { console.debug && console.debug('computeShippingFee called', { city: c, zip: z, barangay: b, subtotal }); } catch (e) {}

    // 1) Mabini-specific barangay fees: only apply if the address is in Mabini
    //    (avoid matching generic barangay names like 'Poblacion' in other towns)
    if (c.includes('mabini') || c.includes('mainaga') || z === '4202') {
        if (b) {
            // Exact match then contains match
            if (mabiniFees.hasOwnProperty(b)) {
                const fee = mabiniFees[b];
                try { console.debug && console.debug('computeShippingFee -> mabini exact', { fee }); } catch (e) {}
                return fee;
            }
            for (const key of Object.keys(mabiniFees)) {
                if (b.includes(key)) {
                    const fee = mabiniFees[key];
                    try { console.debug && console.debug('computeShippingFee -> mabini contains', { key, fee }); } catch (e) {}
                    return fee;
                }
            }
            // Unknown barangay within Mabini: assign default local fee
            try { console.debug && console.debug('computeShippingFee -> unknown mabini barangay, default', { fee: 30 }); } catch (e) {}
            return 30;
        }
        // No barangay provided yet for Mabini — unknown
        return null;
    }

    // 2) If ZIP provided and exists in postalFeeMap
    if (z) {
        const p = postalFeeMap[z];
        if (p !== undefined) {
            if (typeof p === 'object' && p.freeOver && subtotal >= p.freeOver) {
                try { console.debug && console.debug('computeShippingFee -> postal freeOver', { zip: z, fee: 0, freeOver: p.freeOver, subtotal }); } catch (e) {}
                return 0;
            }
            const fee = (typeof p === 'object') ? p.fee : p;
            try { console.debug && console.debug('computeShippingFee -> postal match', { zip: z, fee }); } catch (e) {}
            return fee;
        }
    }

    // 3) Try municipality / city name fuzzy match
    if (c) {
        // Tighten matching rules: require exact municipality name match
        // Normalize by trimming and collapsing whitespace
        const normalizedCity = c.replace(/\s+/g, ' ').trim();
        if (municipalityMap.hasOwnProperty(normalizedCity)) {
            const entry = municipalityMap[normalizedCity];
            if (typeof entry === 'object' && entry.freeOver && subtotal >= entry.freeOver) {
                try { console.debug && console.debug('computeShippingFee -> muni freeOver', { normalizedCity, fee: 0, freeOver: entry.freeOver, subtotal }); } catch (e) {}
                return 0;
            }
            const fee = (typeof entry === 'object') ? entry.fee : entry;
            try { console.debug && console.debug('computeShippingFee -> muni exact match', { normalizedCity, fee }); } catch (e) {}
            return fee;
        }
    }

    // 4) Fallbacks: if zip starts with 42 (Batangas province) but not matched above, assign a reasonable default
    if (z && z.startsWith('42')) {
        try { console.debug && console.debug('computeShippingFee -> zip prefix 42 fallback', { zip: z, fee: 60 }); } catch (e) {}
        return 60;
    }

    // Final default (out of area / further): higher fee
    try { console.debug && console.debug('computeShippingFee -> default', { fee: 80 }); } catch (e) {}
    return 80;
}

// Return true if the provided location is within Batangas province (best-effort)
function isWithinBatangas({city = '', zip = '', barangay = ''} = {}) {
    const c = (city || '').toString().trim().toLowerCase();
    const z = (zip || '').toString().trim();
    const b = (barangay || '').toString().trim().toLowerCase();

    // Zip codes for Batangas province commonly begin with '42' (includes Batangas City, Lipa, Tanauan, etc.)
    if (z && z.startsWith('42')) return true;

    // Common city name checks (best-effort, tolerant)
    const batangasKeywords = ['batangas', 'lipa', 'tanauan', 'nasugbu', 'calaca', 'balete', 'cuenca', 'san juan', 'bauan', 'malvar', 'matabungkay', 'balayan', 'nasugbu', 'talisay', 'agoncillo', 'alitagtag', 'anilao', 'san nicolas', 'san jose'];
    for (const kw of batangasKeywords) {
        if (c.includes(kw)) return true;
        if (b.includes(kw)) return true;
    }

    // Special-case Mabini (Mainaga) — included in Batangas
    if (c.includes('mabini') || c.includes('mainaga') || b.includes('mabini') || b.includes('mainaga')) return true;

    return false;
}

/* Load shipping fees table from data/shipping-fees.json when available.
   Fall back to inline maps if the fetch fails or hasn't completed yet. */
let SHIPPING_FEES = null;
try {
    fetch('data/shipping-fees.json')
        .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
        .then(json => { SHIPPING_FEES = json; try { console.debug && console.debug('shipping fees loaded', json); } catch(e){} })
        .catch(err => { console.warn('Could not load shipping-fees.json, using inline defaults', err); });
} catch (e) {
    console.warn('Fetch not available for shipping fees', e);
}

// Update the checkout totals display: subtotal, shipping, grand total
function updateCheckoutTotals() {
    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const grandEl = document.getElementById('checkout-grand-total');
    const shippingHelpEl = document.getElementById('checkout-shipping-help');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Read city/zip from form (if available)
    const city = document.getElementById('city')?.value || '';
    const zip = document.getElementById('zip')?.value || '';
    const barangay = document.getElementById('barangay')?.value || '';

    const shippingFee = computeShippingFee({city, zip, barangay, subtotal});

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (shippingEl) shippingEl.textContent = (shippingFee === null) ? '—' : ((shippingFee === 0) ? 'Free' : formatCurrency(shippingFee));
    if (grandEl) grandEl.textContent = formatCurrency(subtotal + (shippingFee || 0));

    // Show contextual helper when shipping isn't known yet
    if (shippingHelpEl) {
        if (shippingFee === null) {
            const c = (city || '').toString().trim().toLowerCase();
            const b = (barangay || '').toString().trim().toLowerCase();
            if ((c.includes('mabini') || c.includes('mainaga')) && !b) {
                shippingHelpEl.style.display = 'block';
                shippingHelpEl.textContent = 'Please enter the barangay for Mabini to calculate shipping.';
            } else {
                shippingHelpEl.style.display = 'block';
                shippingHelpEl.textContent = 'Enter city or barangay to calculate shipping cost.';
            }
        } else {
            shippingHelpEl.style.display = 'none';
        }
    }

    return { subtotal, shippingFee, grandTotal: subtotal + (shippingFee || 0) };
}

// Best-effort: ensure totals are recalculated once the full page loads
window.addEventListener('load', function() {
    try {
        // run after a tiny delay to avoid race conditions with other scripts
        setTimeout(() => { try { updateCheckoutTotals(); } catch (e) { /* ignore */ } }, 150);
    } catch (e) { /* ignore */ }
});

function setupCheckoutForm() {
    const checkoutForm = document.getElementById('checkout-form');
    if (!checkoutForm) return;
    
    // Check if user is logged in
    if (!currentUser || currentUser.role !== 'customer') {
        window.location.href = 'login.html?redirect=checkout.html';
        return;
    }
    
    // Check if cart is empty
    if (cart.length === 0) {
        window.location.href = 'menu.html';
        return;
    }
    
    // Pre-fill form with user data if available
    if (currentUser) {
        const nameField = document.getElementById('name');
        const emailField = document.getElementById('email');
        
        if (nameField) nameField.value = currentUser.name;
        if (emailField) emailField.value = currentUser.email;
    }
    
    // Recompute shipping/total when city or zip change
    const cityInput = document.getElementById('city');
    const zipInput = document.getElementById('zip');
    if (cityInput) cityInput.addEventListener('input', () => updateCheckoutTotals());
    if (zipInput) zipInput.addEventListener('input', () => updateCheckoutTotals());
    const barangayInput = document.getElementById('barangay');
    if (barangayInput) barangayInput.addEventListener('input', () => updateCheckoutTotals());
    
    // Populate known Mabini barangays into datalist (so users can pick)
    try { populateBarangayDatalist(); } catch (e) { /* ignore */ }
    
    // Setup payment method UI behavior
    try { setupPaymentMethodUI(); } catch (e) { console.warn('setupPaymentMethodUI failed', e); }

    checkoutForm.addEventListener('submit', function(e) {
        e.preventDefault();
        processOrder();
    });
}

// List of known Mabini barangays and a helper to populate the datalist
const knownMabiniBarangays = [
    'Poblacion', 'San Isidro', 'San Roque', 'San Jose', 'Tambong', 'Anilao East', 'Anilao West'
];

function populateBarangayDatalist() {
    const dl = document.getElementById('barangay-list');
    if (!dl) return;
    // Clear existing
    dl.innerHTML = '';
    knownMabiniBarangays.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        dl.appendChild(opt);
    });
}

async function processOrder() {
    if (!currentUser || currentUser.role !== 'customer') {
        showNotification('Please login as a customer to place an order', 'error');
        return;
    }
    
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const city = document.getElementById('city').value;
    const barangay = document.getElementById('barangay')?.value || '';
    const zip = document.getElementById('zip').value;
    
    // Validate required fields
    if (!name || !email || !phone || !address || !city || !zip) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Enforce delivery area: only allow orders within Batangas province
    if (!isWithinBatangas({ city, zip, barangay })) {
        showNotification('Delivery available within Batangas only. Please enter a Batangas city/zip.', 'error');
        return;
    }
    
    // Determine payment method and validate fields
    const selectedMethodEl = document.querySelector('input[name="payment-method"]:checked');
    const paymentMethod = selectedMethodEl ? selectedMethodEl.value : 'gcash';

    const paymentDetails = {};
    if (paymentMethod === 'card') {
        const cardName = (document.getElementById('card-name')?.value || '').trim();
        const cardNumber = (document.getElementById('card-number')?.value || '').replace(/\s+/g, '');
        const cardExpiry = (document.getElementById('card-expiry')?.value || '').trim();
        const cardCvc = (document.getElementById('card-cvc')?.value || '').trim();

        if (!cardName || !/^\d{13,19}$/.test(cardNumber) || !/^\d{2}\/\d{2}$/.test(cardExpiry) || !/^\d{3,4}$/.test(cardCvc)) {
            showNotification('Please enter valid card details', 'error');
            return;
        }
        paymentDetails.method = 'card';
        paymentDetails.cardHolder = cardName;
        paymentDetails.last4 = cardNumber.slice(-4);
        paymentDetails.exp = cardExpiry;
    } else if (paymentMethod === 'gcash') {
        const gcashRef = (document.getElementById('gcash-ref')?.value || '').trim();

        // We expect a compressed data URL from the upload handler
        const compressedDataUrl = window.__gcashCompressedDataUrl || null;

        // Require BOTH reference number and a verified proof image to proceed
        if (!gcashRef || !compressedDataUrl) {
            showNotification('Please enter the GCash reference number and upload a screenshot to proceed.', 'error');
            return;
        }

        // Strict OCR verification: block submission unless OCR previously matched the entered reference
        const ocrMatch = !!window.__gcashOcrMatch;
        const ocrText = (window.__gcashOcrText || '').toString();
        const normalizedRef = gcashRef.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const normalizedOcr = ocrText.replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (!ocrMatch || !normalizedRef || !normalizedOcr.includes(normalizedRef)) {
            showNotification('Reference number not detected in uploaded image. Please upload a photo that clearly shows the reference.', 'error');
            return;
        }

        paymentDetails.method = 'gcash';
        paymentDetails.referenceNo = gcashRef;
        paymentDetails.gcashProofDataUrl = compressedDataUrl;
    } else if (paymentMethod === 'cod') {
        paymentDetails.method = 'cod';
    }

    // Generate order ID
    const orderId = 'ORD' + Math.floor(10000 + Math.random() * 90000);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = computeShippingFee({ city, zip, barangay, subtotal }) || 0;
    const total = subtotal + shippingFee;
    // Normalize municipality id from city for faster lookup in admin
    const municipalityId = (city || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '') || '';
    
    // Create new order
    const newOrder = {
        id: orderId,
        customer: name,
        customerEmail: email,
        customerPhone: phone,
    deliveryAddress: `${address}${barangay ? ', ' + barangay : ''}, ${city}, ${zip}`,
    deliveryBarangay: barangay,
        municipality: municipalityId,
        deliveryCity: city,
        items: [...cart],
        orderNotes: (document.getElementById('order-notes')?.value || '').trim(),
    subtotal: subtotal,
    shippingFee: shippingFee,
    total: total,
        status: 'preparing',
        deliveryTime: '30-40 minutes',
        timestamp: new Date().getTime(),
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails
    };
    
    // Try to save order to the server (Netlify function -> Neon DB). If the server
    // is unavailable or returns an error, fall back to local persistence.
    try {
        const resp = await fetch('/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newOrder)
        });

        if (resp.ok) {
            const data = await resp.json();
            if (data && data.order) {
                // keep returned DB row for reference
                newOrder._remote = data.order;
            }
            // Also keep a local copy for quick access
            if (typeof saveOrders === 'function') {
                database.orders.push(newOrder);
                saveOrders();
            } else {
                database.orders.push(newOrder);
                try { localStorage.setItem('orders', JSON.stringify(database.orders)); } catch (e) { console.warn('Could not save orders to localStorage', e); }
            }
        } else {
            // Server rejected save — fallback to local
            console.warn('Server rejected order save', resp.statusText);
            database.orders.push(newOrder);
            try { localStorage.setItem('orders', JSON.stringify(database.orders)); } catch (e) { console.warn('Could not save orders to localStorage', e); }
        }
    } catch (err) {
        console.warn('Could not reach save endpoint, saving locally', err);
        database.orders.push(newOrder);
        try { localStorage.setItem('orders', JSON.stringify(database.orders)); } catch (e) { console.warn('Could not save orders to localStorage', e); }
    }

    // Send order confirmation email
    sendOrderConfirmation(newOrder);

    // Clear cart
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // Show confirmation and redirect to a dedicated confirmation page
    showNotification(`Order placed successfully! Your order ID is ${orderId}`);

    setTimeout(() => {
        // Redirect to the order confirmation page which includes copy/track actions
        window.location.href = `order-confirmation.html?order=${orderId}`;
    }, 1200);
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCartDisplay();
});

// Toggle payment fields visibility and requiredness based on selected method
function setupPaymentMethodUI() {
    const radios = document.querySelectorAll('input[name="payment-method"]');
    const cardGroup = document.getElementById('card-fields');
    const gcashGroup = document.getElementById('gcash-fields');
    const gcashProof = document.getElementById('gcash-proof');
    const gcashRef = document.getElementById('gcash-ref');
    const gcashOpenBtn = document.getElementById('gcash-open-app-btn');

    // Bind open button if present
    if (gcashOpenBtn) {
        gcashOpenBtn.addEventListener('click', () => tryOpenGCashApp());
    }

    // GCash proof preview & validation
    const gcashProofInput = document.getElementById('gcash-proof');
    if (gcashProofInput) {
        gcashProofInput.addEventListener('change', async function () {
            const file = this.files?.[0] || null;
            const preview = document.getElementById('gcash-proof-preview');
            const errorEl = document.getElementById('gcash-proof-error');
            if (!file) {
                if (preview) { preview.style.display = 'none'; preview.src = ''; }
                if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
                return;
            }

            try {
                const dataUrl = await validateAndCompressImage(file);
                if (preview) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                }
                if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

                // Store compressed data URL globally for use during submission
                window.__gcashCompressedDataUrl = dataUrl;

                // Begin OCR verification (lazy-load Tesseract). Show status while running.
                if (errorEl) {
                    errorEl.style.display = 'block';
                    errorEl.style.color = '#bbb';
                    errorEl.textContent = 'Verifying reference number in image...';
                }

                try {
                    const ocrText = await runOcrOnDataUrl(dataUrl);
                    window.__gcashOcrText = ocrText || '';
                    const ref = (document.getElementById('gcash-ref')?.value || '').trim();
                    const normalizedRef = ref.replace(/[^a-z0-9]/gi, '').toLowerCase();
                    const normalizedOcr = (window.__gcashOcrText || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
                    const matched = normalizedRef && normalizedRef.length >= 3 && normalizedOcr.includes(normalizedRef);
                    window.__gcashOcrMatch = !!matched;

                    if (matched) {
                        if (errorEl) { errorEl.style.color = '#2ecc71'; errorEl.textContent = 'Reference number detected in image.'; }
                    } else {
                        if (errorEl) { errorEl.style.color = '#ff6b6b'; errorEl.textContent = 'Reference number not found in image. Submission will be blocked until a matching image is uploaded.'; }
                    }
                } catch (ocrErr) {
                    window.__gcashOcrText = '';
                    window.__gcashOcrMatch = false;
                    if (errorEl) { errorEl.style.color = '#ff6b6b'; errorEl.textContent = 'Could not verify image text. Please upload a clearer photo.'; }
                }

            } catch (err) {
                if (preview) { preview.style.display = 'none'; preview.src = ''; }
                if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = err.message || 'Invalid image file'; }
                // Clear invalid file selection
                this.value = '';
            }
        });
    }

    // Re-check OCR match when reference input changes (compare against stored OCR text)
    const refInput = document.getElementById('gcash-ref');
    if (refInput) {
        refInput.addEventListener('input', function () {
            const errorEl = document.getElementById('gcash-proof-error');
            const ref = (this.value || '').trim();
            const normalizedRef = ref.replace(/[^a-z0-9]/gi, '').toLowerCase();
            const normalizedOcr = (window.__gcashOcrText || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
            const matched = normalizedRef && normalizedRef.length >= 3 && normalizedOcr.includes(normalizedRef);
            window.__gcashOcrMatch = !!matched;
            if (!window.__gcashOcrText) {
                if (errorEl) { errorEl.style.display = 'block'; errorEl.style.color = '#ff6b6b'; errorEl.textContent = 'No OCR data available — upload a clear image showing the reference.'; }
                return;
            }
            if (matched) {
                if (errorEl) { errorEl.style.display = 'block'; errorEl.style.color = '#2ecc71'; errorEl.textContent = 'Reference number detected in image.'; }
            } else {
                if (errorEl) { errorEl.style.display = 'block'; errorEl.style.color = '#ff6b6b'; errorEl.textContent = 'Reference number not found in image. Submission will be blocked until a matching image is uploaded.'; }
            }
        });
    }

    // Prevent repeatedly auto-opening when user switches methods
    let gcashAutoOpenTriggered = false;

    const setRequired = (el, required) => { if (el) el.required = !!required; };

    const apply = (method) => {
        if (cardGroup) cardGroup.style.display = method === 'card' ? 'block' : 'none';
        if (gcashGroup) gcashGroup.style.display = method === 'gcash' ? 'block' : 'none';

        // Card fields required only when card selected
        setRequired(document.getElementById('card-name'), method === 'card');
        setRequired(document.getElementById('card-number'), method === 'card');
        setRequired(document.getElementById('card-expiry'), method === 'card');
        setRequired(document.getElementById('card-cvc'), method === 'card');

        // For GCash, reference and proof are required (enforced during submission too)
        setRequired(document.getElementById('gcash-name'), false);
        setRequired(document.getElementById('gcash-number'), false);
        setRequired(document.getElementById('gcash-ref'), method === 'gcash');
        setRequired(gcashProof, method === 'gcash');

        // Best-effort: when GCash is selected, attempt to open the GCash app once
        if (method === 'gcash' && !gcashAutoOpenTriggered) {
            gcashAutoOpenTriggered = true;
            tryOpenGCashApp();
        }
    };

    const current = document.querySelector('input[name="payment-method"]:checked');
    apply(current ? current.value : 'gcash');

    radios.forEach(r => r.addEventListener('change', () => apply(r.value)));
}

// Validate and compress uploaded image file. Returns dataURL string.
async function validateAndCompressImage(file) {
    const maxOriginalSize = 4 * 1024 * 1024; // 4MB
    const maxSavedSize = 600 * 1024; // 600KB target
    const maxDim = 1024; // max width/height

    if (!file || !file.type || !file.type.startsWith('image/')) {
        throw new Error('Please upload a valid image file (jpg, png, webp).');
    }

    if (file.size > maxOriginalSize) {
        throw new Error('Image is too large. Please upload an image under 4 MB.');
    }

    // Create image from file
    const img = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const i = new Image();
        i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
        i.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('Could not read image file')); };
        i.src = url;
    });

    // Calculate target size
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Try compressing to JPEG with decreasing quality until under limit
    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    const estimateSize = (d) => {
        const base64 = d.split(',')[1] || '';
        return Math.ceil(base64.length * 3 / 4);
    };

    let size = estimateSize(dataUrl);
    while (size > maxSavedSize && quality > 0.5) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        size = estimateSize(dataUrl);
    }

    if (size > maxSavedSize) {
        throw new Error('Could not compress image under the size limit. Try a smaller image or crop it.');
    }

    return dataUrl;
}

// Attempt to open the GCash app using best-effort deep links with safe fallbacks
function tryOpenGCashApp() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isAndroid = ua.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(ua);

    // Note: There is no publicly documented payment deep link. These links try to open the app home.
    const iosScheme = 'gcash://';
    const androidIntent = 'intent://open#Intent;scheme=gcash;package=com.globe.gcash.android;end';
    const fallbackUrl = 'https://www.gcash.com/';

    // Opening via a short-lived iframe helps avoid blocking in some browsers
    let didNavigate = false;
    const start = Date.now();

    const openUrl = (url) => {
        try {
            // Prefer assigning to location; many browsers allow it from a user gesture
            window.location.href = url;
            didNavigate = true;
        } catch (e) {
            // As a fallback, create an iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);
            setTimeout(() => {
                try { document.body.removeChild(iframe); } catch (_) {}
            }, 2000);
        }
    };

    if (isAndroid) {
        openUrl(androidIntent);
    } else if (isIOS) {
        openUrl(iosScheme);
    } else {
        // Desktop: just push users to GCash site
        window.open(fallbackUrl, '_blank');
        return;
    }

    // Fallback to website if app didn't open within ~1.5s
    setTimeout(() => {
        const elapsed = Date.now() - start;
        if (!didNavigate || elapsed < 200) {
            try {
                window.open(fallbackUrl, '_blank');
            } catch (_) {
                window.location.href = fallbackUrl;
            }
        }
    }, 1500);
}