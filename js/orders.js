// Order functions
function setupOrderTracking() {
    const trackBtn = document.getElementById('track-btn');
    const orderDetails = document.getElementById('order-details');
    
    if (!trackBtn) return;
    
    // Check URL for order parameter
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdFromUrl = urlParams.get('order');
    if (orderIdFromUrl) {
        document.getElementById('order-id').value = orderIdFromUrl;
        trackOrder(orderIdFromUrl);
    }
    
    trackBtn.addEventListener('click', function() {
        const orderId = document.getElementById('order-id').value;
        if (orderId) {
            trackOrder(orderId);
        } else {
            showNotification('Please enter an order ID', 'error');
        }
    });

    // Listen for orders changes in other tabs (admin updates) and refresh if the same order is open
    window.addEventListener('storage', function(e) {
        if (e.key === 'orders') {
            const params = new URLSearchParams(window.location.search);
            const orderIdFromUrl = params.get('order');
            if (orderIdFromUrl) {
                // re-run tracking to pick up new status
                trackOrder(orderIdFromUrl);
            }
        }
    });
}

function trackOrder(orderId) {
    const order = database.orders.find(order => order.id === orderId);
    const orderDetails = document.getElementById('order-details');
    
    if (!orderDetails) return;
    
    if (order) {
        // If a customer is logged in, ensure they can only view their own orders.
        // Guests are allowed to track orders by Order ID (non-sensitive status info only).
        if (currentUser && currentUser.role === 'customer' && order.customerEmail !== currentUser.email) {
            showNotification('You can only track your own orders', 'error');
            return;
        }
        
        document.getElementById('order-number').textContent = order.id;
        document.getElementById('order-status-text').textContent = order.status;
        document.getElementById('delivery-time').textContent = order.deliveryTime;

    // Show pricing breakdown if available
    const trackSubtotalEl = document.getElementById('track-subtotal');
    const trackShippingEl = document.getElementById('track-shipping');
    const trackTotalEl = document.getElementById('track-total');
    if (trackSubtotalEl) trackSubtotalEl.textContent = formatCurrency(order.subtotal || 0);
    if (trackShippingEl) trackShippingEl.textContent = (typeof order.shippingFee === 'number') ? (order.shippingFee === 0 ? 'Free' : formatCurrency(order.shippingFee)) : '—';
    if (trackTotalEl) trackTotalEl.textContent = formatCurrency(order.total || 0);
        
        // Update status timeline based on order status
        const statusSteps = document.querySelectorAll('.status-step');
        statusSteps.forEach(step => step.classList.remove('completed', 'active'));
        
        const status = order.status.toLowerCase();
        if (status === 'preparing') {
            statusSteps[0].classList.add('completed');
            statusSteps[1].classList.add('active');
        } else if (status === 'on the way') {
            statusSteps[0].classList.add('completed');
            statusSteps[1].classList.add('completed');
            statusSteps[2].classList.add('active');
        } else if (status === 'delivered') {
            statusSteps.forEach(step => step.classList.add('completed'));
        } else if (status === 'placed') {
            statusSteps[0].classList.add('active');
        }
        
        // Display order items
        const orderItemsList = document.getElementById('order-items-list');
        orderItemsList.innerHTML = '';
        order.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`;
            orderItemsList.appendChild(li);
        });
        
        orderDetails.classList.remove('hidden');
        // Add or update a Cancel button inside the order details for customers
        try {
            let cancelBtn = document.getElementById('cancel-order-btn');
            if (!cancelBtn) {
                cancelBtn = document.createElement('button');
                cancelBtn.id = 'cancel-order-btn';
                cancelBtn.className = 'btn btn-outline';
                cancelBtn.textContent = 'Cancel Order';
                const controls = document.createElement('div');
                controls.style.marginTop = '0.8rem';
                controls.appendChild(cancelBtn);
                orderDetails.appendChild(controls);
            }
            // Show or hide depending on cancellable state
            const cancellable = !['delivered','completed','cancelled','on the way'].includes((order.status||'').toString().toLowerCase());
            cancelBtn.style.display = cancellable ? 'inline-block' : 'none';
            cancelBtn.onclick = async function() {
                const ok = await window.showConfirmModal({
                    title: 'Cancel order',
                    message: 'Cancel this order?',
                    okText: 'Yes, cancel',
                    cancelText: 'No'
                });
                if (!ok) return;
                cancelOrder(order.id);
            };
        } catch (e) { /* ignore DOM issues */ }
    } else {
        showNotification('Order not found', 'error');
    }
}

// Save orders to localStorage
function saveOrders() {
    localStorage.setItem('orders', JSON.stringify(database.orders));
}

// Cancel an order (can be invoked by customer, staff, or admin)
function cancelOrder(orderId, by = (currentUser && currentUser.email) || 'system') {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return showNotification('Order not found', 'error');

    const status = (order.status || '').toString().toLowerCase();
    // Prevent cancelling delivered/completed/on the way or already cancelled orders
    if (status === 'delivered' || status === 'completed' || status === 'cancelled' || status === 'on the way') {
        return showNotification('This order cannot be cancelled', 'error');
    }

    order.status = 'cancelled';
    order.statusTimestamps = order.statusTimestamps || {};
    order.statusTimestamps.cancelled = Date.now();
    order.cancelledBy = by;
    order.cancelledAt = Date.now();

    // persist and notify other tabs
    saveOrders();
    try { localStorage.setItem('orders', JSON.stringify(database.orders)); } catch (e) {}

    showNotification(`Order ${orderId} has been cancelled`);

    // If we're on the customer's orders page, try to refresh the list
    try { if (document.getElementById('orders-list')) {
        const list = document.getElementById('orders-list');
        const refreshed = getCustomerOrders();
        if (refreshed.length === 0) list.innerHTML = '<p>You have no orders yet.</p>'; else {
            list.innerHTML = refreshed.map(o => `
                <div class="order-info" style="margin-bottom:1rem; padding:0.8rem; background: rgba(255,255,255,0.03); border-radius:6px;">
                    <h4>Order <strong>${o.id}</strong> — <span style="color:var(--secondary);">${o.status}</span></h4>
                    <p><strong>Date:</strong> ${new Date(o.timestamp).toLocaleString()}</p>
                    <p><strong>Total:</strong> ${formatCurrency(o.total || 0)}</p>
                    <div style="display:flex; gap:0.6rem; margin-top:0.6rem;">
                        <a class="btn" href="track-order.html?order=${o.id}">Track</a>
                        <a class="btn btn-outline" href="order-confirmation.html?order=${o.id}">View</a>
                        ${(['delivered','completed','cancelled'].includes((o.status||'').toString().toLowerCase()) ? '' : `<button class="btn btn-outline" data-cancel="${o.id}">Cancel</button>`)}
                    </div>
                </div>
            `).join('');

            // Wire newly-added cancel buttons
            document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', (ev) => {
                const id = b.getAttribute('data-cancel');
                if (!id) return;
                (async function(){
                    const ok = await window.showConfirmModal({
                        title: 'Cancel order',
                        message: 'Cancel this order?',
                        okText: 'Yes, cancel',
                        cancelText: 'No'
                    });
                    if (!ok) return;
                    cancelOrder(id);
                })();
            }));
        }
    }} catch (e) { /* ignore render errors */ }

    // Allow admin/staff views to update as well by reloading admin table if present
    try { if (typeof loadOrdersTable === 'function') loadOrdersTable(); } catch (e) {}
}

function sendOrderConfirmation(order) {
    // In a real application, this would send an actual email
    // For demo purposes, we'll simulate email sending
    console.log('Sending order confirmation email to:', order.customerEmail);
    console.log('Order Details:', order);
    
    // Simulate email sending
    const emailContent = `
        The Burger  Order Confirmation
        ============================
        
        Thank you for your order, ${order.customer}!
        
        Order ID: ${order.id}
    Order Total: ${formatCurrency(order.total)}
        
        Items:
    ${order.items.map(item => `- ${item.quantity}x ${item.name}: ${formatCurrency(item.price * item.quantity)}`).join('\n')}
        
        Delivery Address:
        ${order.deliveryAddress}
        
        Estimated Delivery: ${order.deliveryTime}
        
        Status: ${order.status}
        
    You can track your order at: ${window.location.origin}/track-order.html?order=${order.id}
    You can also view your confirmation page at: ${window.location.origin}/order-confirmation.html?order=${order.id}
        
        Thank you for choosing The Burger !
    `;
    
    console.log('Email content:', emailContent);
    
    // In a real app, you would use an email service like:
    // - SendGrid
    // - Mailgun
    // - AWS SES
    // - Nodemailer (for Node.js backend)
}

function getCustomerOrders() {
    if (!currentUser || currentUser.role !== 'customer') {
        return [];
    }
    
    return database.orders.filter(order => order.customerEmail === currentUser.email)
                         .sort((a, b) => b.timestamp - a.timestamp);
}

// Initialize orders on page load
document.addEventListener('DOMContentLoaded', function() {
    // Order tracking is set up in setupOrderTracking()
});