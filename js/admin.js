// ==========================
// Admin Panel JS - The Burger 
// ==========================

// Load admin data
function loadAdminData() {
    if (!currentUser || (currentUser.role !== "staff" && currentUser.role !== "admin")) {
        showNotification("Access denied. Staff or admin privileges required.", "error");
        window.location.href = "index.html";
        return;
    }

    loadOrdersTable();
    // Setup admin-only actions for orders (e.g., clear all)
    setupOrderAdminActions();

    // Listen for orders changes from other tabs (e.g., customer cancelled an order)
    window.addEventListener('storage', function(e) {
        try {
            if (e.key === 'orders') {
                const updated = JSON.parse(e.newValue || '[]');
                if (Array.isArray(updated)) {
                    database.orders = updated;
                    // refresh the orders table and dashboard metrics
                    try { loadOrdersTable(); } catch (err) {}
                    try { if (currentUser && currentUser.role === 'admin') updateAdminDashboardMetrics(); } catch (err) {}
                }
            }
        } catch (err) { /* ignore malformed storage updates */ }
    });

    // If the user is an admin, initialize dashboard metrics and charts.
    if (currentUser.role === "admin") {
        try { updateAdminDashboardMetrics(); } catch (e) { /* ignore */ }
        // Setup chart range controls (7/14/30 days)
        try { setupSalesChartControls(); } catch (e) { /* ignore */ }
        // Admins also manage menu and users
        loadMenuItemsTable();
        loadUsersTable();
        // Per request: remove Orders tab entirely for admins (keep Orders available for staff)
        try {
            const ordersTab = document.querySelector('.admin-tab[data-tab="orders"]');
            const ordersContent = document.getElementById('orders-content');
            if (ordersTab) ordersTab.style.display = 'none';
            if (ordersContent) ordersContent.style.display = 'none';
        } catch (e) { /* ignore DOM errors */ }
    } else {
        // For non-admin staff: hide dashboard tab and content so dashboard is admin-only
        document.querySelectorAll('.admin-tab[data-tab="menu-items"], .admin-tab[data-tab="users"]').forEach(tab => (tab.style.display = "none"));
        const dashTab = document.querySelector('.admin-tab[data-tab="dashboard"]');
        const dashContent = document.getElementById('dashboard-content');
        if (dashTab) dashTab.style.display = 'none';
        if (dashContent) dashContent.style.display = 'none';

        // Activate Orders tab by default for staff
        const ordersTab = document.querySelector('.admin-tab[data-tab="orders"]');
        const ordersContent = document.getElementById('orders-content');
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        if (ordersTab) ordersTab.classList.add('active');
        document.querySelectorAll('.admin-content').forEach(c => c.style.display = 'none');
        if (ordersContent) ordersContent.style.display = 'block';
    }
}

// Compute and update admin dashboard metrics (today's sales, monthly sales, totals)
function updateAdminDashboardMetrics() {
    try {
        const now = new Date();
        const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const month = now.getMonth();
        const year = now.getFullYear();

    let todaysSales = 0;
    let monthSales = 0;
    let totalOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let revenueYTD = 0;
    let overallRevenue = 0;
    let cancelledOrders = 0;

        (Array.isArray(database.orders) ? database.orders : []).forEach(o => {
            totalOrders += 1;
            const ts = o.timestamp || o.date || 0;
            let t = typeof ts === 'number' ? ts : (Date.parse(ts) || 0);
            // consider delivered/completed for sales totals
            const status = (o.status || '').toString().toLowerCase();
            if (['delivered','completed','cancelled'].indexOf(status) === -1) pendingOrders += 1;
            if (status === 'cancelled') cancelledOrders += 1;

            const orderTotal = Number(o.total) || 0;
            // Today's sales: include orders whose timestamp is today and are delivered/completed
            const d = new Date(t);
            if (!isNaN(t)) {
                const orderDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                if (orderDay === todayStr && (status === 'delivered' || status === 'completed')) {
                    todaysSales += orderTotal;
                }
                if (d.getFullYear() === year && d.getMonth() === month && (status === 'delivered' || status === 'completed')) {
                    monthSales += orderTotal;
                }
                // revenue YTD and completed count
                if ((status === 'delivered' || status === 'completed')) {
                    completedOrders += 1;
                    if (d.getFullYear() === year) revenueYTD += orderTotal;
                    overallRevenue += orderTotal;
                }
            }
        });

        // Update DOM
        const elToday = document.getElementById('dashboard-today-sales');
        const elMonth = document.getElementById('dashboard-month-sales');
        const elMonthLabel = document.getElementById('dashboard-month-label');
        const elTotal = document.getElementById('dashboard-total-orders');
        const elPending = document.getElementById('dashboard-pending-orders');

        if (elToday) elToday.textContent = formatCurrency(todaysSales);
        if (elMonth) elMonth.textContent = formatCurrency(monthSales);
        if (elMonthLabel) elMonthLabel.textContent = `${now.toLocaleString('default', { month: 'long' })} ${year}`;
        if (elTotal) elTotal.textContent = String(totalOrders);
        if (elPending) elPending.textContent = String(pendingOrders);

    // Additional metrics: completed orders and average order value
    const elCompleted = document.getElementById('dashboard-completed-orders');
    const elAvg = document.getElementById('dashboard-avg-order');
    const elYTD = document.getElementById('dashboard-year-sales');
    if (elCompleted) elCompleted.textContent = String(completedOrders);
    if (elAvg) elAvg.textContent = formatCurrency(completedOrders > 0 ? (revenueYTD / completedOrders) : 0);
    if (elYTD) elYTD.textContent = formatCurrency(revenueYTD);

    // Cancelled orders metric (customer cancellations)
    const elCancelled = document.getElementById('dashboard-cancelled-orders');
    if (elCancelled) elCancelled.textContent = String(cancelledOrders);

    // Update overall revenue element if present
    const elTotalRevenueAll = document.getElementById('dashboard-total-revenue');
    if (elTotalRevenueAll) elTotalRevenueAll.textContent = formatCurrency(overallRevenue || revenueYTD);

        // Optionally draw a small sales chart (last 7 days)
        try {
            drawSalesChart();
        } catch (e) { /* ignore chart errors */ }
    } catch (e) {
        console.warn('updateAdminDashboardMetrics failed', e);
    }
}

// Draw a simple line chart for the last 7 days sales into #sales-chart (vanilla canvas)
function drawSalesChart(rangeDays = 7, municipalityId = null) {
    // Enhanced chart: show both completed/delivered sales and preparing amounts
    const canvas = document.getElementById('sales-chart');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0,0,w,h);

    // prepare N-day buckets
    const days = [];
    const completed = [];
    const preparing = [];
    const cancelled = [];
    const now = new Date();
    for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push(d);
        completed.push(0);
        preparing.push(0);
        cancelled.push(0);
    }

    (Array.isArray(database.orders) ? database.orders : []).forEach(o => {
        // If municipalityId filter is provided, skip orders that don't match.
        // Use explicit order.municipality when available, otherwise fall back to parsing the address.
        if (municipalityId) {
            const oid = getOrderMunicipalityId(o);
            if (oid !== municipalityId) return;
        }
        const ts = o.timestamp || o.date || 0;
        let t = typeof ts === 'number' ? ts : (Date.parse(ts) || 0);
        if (!t) return;
        const d = new Date(t);
        for (let i = 0; i < days.length; i++) {
            const dd = days[i];
            if (d.getFullYear() === dd.getFullYear() && d.getMonth() === dd.getMonth() && d.getDate() === dd.getDate()) {
                const status = (o.status || '').toString().toLowerCase();
                const val = Number(o.total) || 0;
                if (status === 'delivered' || status === 'completed') completed[i] += val;
                else if (status === 'preparing') preparing[i] += val;
                else if (status === 'cancelled') cancelled[i] += val;
                break;
            }
        }
    });

    const combinedMax = Math.max(1, ...completed, ...preparing, ...cancelled);
    const allZero = completed.every(v => v === 0) && preparing.every(v => v === 0) && cancelled.every(v => v === 0);
    const pad = 20 * devicePixelRatio;
    const left = 40 * devicePixelRatio;
    const right = 10 * devicePixelRatio;
    const top = 20 * devicePixelRatio;
    const bottom = 30 * devicePixelRatio;
    const plotW = w - left - right;
    const plotH = h - top - bottom;

    if (allZero) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = 'rgba(200,200,200,0.6)';
        ctx.font = `${14 * devicePixelRatio}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`No sales or preparing amounts in the last ${rangeDays} days`, w/2, h/2);
        // still update title + legend to reflect range
        const title = document.getElementById('sales-overview-title');
        if (title) title.textContent = `Sales Overview (Last ${rangeDays} Days)`;
        const legendEl = document.getElementById('sales-chart-legend');
        if (legendEl) legendEl.innerHTML = '';
        return;
    }

    // draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1 * devicePixelRatio;
    for (let g = 0; g <= 4; g++) {
        const y = top + (g / 4) * plotH;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
    }

    // helper to compute XY for a value/index
    function xyFor(i, val) {
        const x = left + (i / (days.length - 1)) * plotW;
        const y = top + (1 - (val / combinedMax)) * plotH;
        return { x, y };
    }

    // animate drawing both lines
    const duration = 600; // ms
    let startTime = null;
    function drawFrame(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min(1, (ts - startTime) / duration);

        ctx.clearRect(0,0,w,h);
        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1 * devicePixelRatio;
        for (let g = 0; g <= 4; g++) {
            const y = top + (g / 4) * plotH;
            ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
        }

        // completed line (solid orange)
        ctx.strokeStyle = 'rgba(243,156,18,0.95)';
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.beginPath();
        completed.forEach((val, i) => {
            const pVal = val * progress;
            const { x, y } = xyFor(i, pVal);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // preparing line (dashed blue)
        ctx.strokeStyle = 'rgba(52,152,219,0.95)';
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.setLineDash([6 * devicePixelRatio, 4 * devicePixelRatio]);
        ctx.beginPath();
        preparing.forEach((val, i) => {
            const pVal = val * progress;
            const { x, y } = xyFor(i, pVal);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // cancelled line (dashed red) - shows cancelled order totals (for visibility)
        ctx.strokeStyle = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#e74c3c').trim();
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio]);
        ctx.beginPath();
        cancelled.forEach((val, i) => {
            const pVal = val * progress;
            const { x, y } = xyFor(i, pVal);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // draw points
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `${12 * devicePixelRatio}px sans-serif`;
        completed.forEach((val, i) => {
            const { x, y } = xyFor(i, val * progress);
            ctx.beginPath(); ctx.arc(x, y, 3 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
        });

        // Draw fewer, evenly-spaced x-axis date labels to avoid overlap
        ctx.fillStyle = 'rgba(200,200,200,0.9)';
        ctx.textAlign = 'center';
        const maxLabels = 6;
        const step = Math.max(1, Math.ceil(days.length / maxLabels));
        for (let i = 0; i < days.length; i++) {
            if (i % step !== 0 && i !== days.length - 1) continue;
            const label = days[i].toLocaleString('en-PH', { month: 'short', day: 'numeric' });
            const { x } = xyFor(i, 0);
            ctx.fillText(label, x, h - 6 * devicePixelRatio);
        }
        ctx.textAlign = 'start';

        // preparing points (smaller, blue)
        ctx.fillStyle = 'rgba(52,152,219,0.95)';
        preparing.forEach((val, i) => {
            const { x, y } = xyFor(i, val * progress);
            if (val > 0) {
                ctx.beginPath(); ctx.arc(x, y, 2 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
            }
        });

        // cancelled points (red)
        ctx.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#e74c3c').trim();
        cancelled.forEach((val, i) => {
            const { x, y } = xyFor(i, val * progress);
            if (val > 0) {
                ctx.beginPath(); ctx.arc(x, y, 2.5 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
            }
        });

        if (progress < 1) requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);

    // Simple tooltip: create if missing
    let tip = document.getElementById('sales-chart-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'sales-chart-tooltip';
        // Use fixed positioning so the tooltip isn't clipped by parent containers
        // (some dashboard cards use overflow/transform which can hide absolute children).
        tip.style.position = 'fixed';
        tip.style.pointerEvents = 'none';
        tip.style.padding = '8px 10px';
        tip.style.background = 'rgba(17,17,17,0.95)';
        tip.style.color = '#fff';
        tip.style.fontSize = '12px';
        tip.style.borderRadius = '6px';
        tip.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
        tip.style.zIndex = '100000';
        tip.style.display = 'none';
        document.body.appendChild(tip);
    }

    // position helper and event handlers
    function showTooltip(evt) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) * devicePixelRatio;
        // find nearest index by x
        let nearest = 0; let nearestDist = Infinity;
        for (let i = 0; i < days.length; i++) {
            const x = left + (i / (days.length - 1)) * plotW;
            const d = Math.abs(x - mouseX);
            if (d < nearestDist) { nearestDist = d; nearest = i; }
        }

        const dateLabel = days[nearest].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        const comp = completed[nearest] || 0;
        const prep = preparing[nearest] || 0;
        const canc = cancelled[nearest] || 0;
        const dangerColor = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#e74c3c').trim();
        tip.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:6px; min-width:160px;">
                <div style="font-weight:700; margin-bottom:4px;">${dateLabel}</div>
                <div style="display:flex; align-items:center; gap:8px;"> <span style="width:10px;height:10px;background:#f39c12;display:inline-block;border-radius:2px;"></span> <div>Completed: <strong>${formatCurrency(comp)}</strong></div> </div>
                <div style="display:flex; align-items:center; gap:8px;"> <span style="width:10px;height:10px;background:#3498db;display:inline-block;border-radius:2px;"></span> <div>Preparing: <strong>${formatCurrency(prep)}</strong></div> </div>
                <div style="display:flex; align-items:center; gap:8px;"> <span style="width:10px;height:10px;background:${dangerColor};display:inline-block;border-radius:2px;"></span> <div>Cancelled: <strong>${formatCurrency(canc)}</strong></div> </div>
            </div>`;
        tip.style.display = 'block';
        // prefer placing above cursor; clamp to viewport
        const tipRect = tip.getBoundingClientRect();
        let leftPos = evt.clientX + 12;
        let topPos = evt.clientY - tipRect.height - 12;
        if (leftPos + tipRect.width > window.innerWidth - 8) leftPos = window.innerWidth - tipRect.width - 8;
        if (topPos < 8) topPos = evt.clientY + 12;
        tip.style.left = leftPos + 'px';
        tip.style.top = topPos + 'px';
    }

    function hideTooltip() {
        if (tip) tip.style.display = 'none';
    }

    canvas.removeEventListener('mousemove', canvas._salesChartMove || (()=>{}));
    canvas.removeEventListener('mouseleave', canvas._salesChartLeave || (()=>{}));
    canvas._salesChartMove = showTooltip;
    canvas._salesChartLeave = hideTooltip;
    canvas.addEventListener('mousemove', canvas._salesChartMove);
    canvas.addEventListener('mouseleave', canvas._salesChartLeave);

    // update title and legend
    const title = document.getElementById('sales-overview-title');
    if (title) title.textContent = municipalityId ? `Sales Overview (${document.getElementById(municipalityId)?.dataset?.label || municipalityId} • Last ${rangeDays} Days)` : `Sales Overview (Last ${rangeDays} Days)`;
    const legendEl = document.getElementById('sales-chart-legend');
    if (legendEl) {
        const totalCompleted = completed.reduce((a,b)=>a+b,0);
        const totalPreparing = preparing.reduce((a,b)=>a+b,0);
        const totalCancelled = cancelled.reduce((a,b)=>a+b,0);
        legendEl.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:12px;height:12px;background:#f39c12;display:inline-block;border-radius:2px;"></span> Completed ${formatCurrency(totalCompleted)}</span>
            <span style="display:inline-flex; align-items:center; gap:6px; margin-left:8px;"><span style="width:12px;height:12px;background:#3498db;display:inline-block;border-radius:2px;"></span> Preparing ${formatCurrency(totalPreparing)}</span>
            <span style="display:inline-flex; align-items:center; gap:6px; margin-left:8px;"><span style="width:12px;height:12px;background:${(getComputedStyle(document.documentElement).getPropertyValue('--danger')||'#e74c3c').trim()};display:inline-block;border-radius:2px;"></span> Cancelled ${formatCurrency(totalCancelled)}</span>
        `;
    }
}

// Wire the range selector buttons so admin can choose 7/14/30 days
function setupSalesChartControls() {
    if (window._salesChartControlsSetup) return;
    window._salesChartControlsSetup = true;
    const btns = document.querySelectorAll('.chart-range-btn');
    if (!btns || btns.length === 0) return;
    btns.forEach(b => {
        b.addEventListener('click', () => {
            btns.forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            const days = parseInt(b.dataset.days, 10) || 7;
            try { drawSalesChart(days, currentMunicipalitySelection()); } catch (e) { console.warn('drawSalesChart failed', e); }
            try { renderTopItems(days, currentMunicipalitySelection()); } catch (e) { /* ignore */ }
        });
    });
}

// Helper: return the currently selected municipality id (if any)
function currentMunicipalitySelection() {
    // prefer an active panel's id
    const active = document.querySelector('.location-grid.location-active');
    if (active && active.id) return active.id;
    // fallback to native select if present
    const sel = document.getElementById('location-select');
    if (sel && sel.value) return sel.value;
    return null;
}

// Render a Top Selling Items list into #top-items-list for the past `rangeDays` days
function renderTopItems(rangeDays = 30) {
    // optional municipalityId filter as second arg
    const municipalityId = arguments[1] || null;
    const container = document.getElementById('top-items-list');
    const title = document.getElementById('top-items-title');
    if (title) title.textContent = `Top Selling Items (Last ${rangeDays} Days)`;
    if (!container) return;
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (rangeDays - 1)).getTime();

        // Aggregate by item id (fallback to name)
        const agg = {}; // id/name -> { name, qty, revenue }
        (Array.isArray(database.orders) ? database.orders : []).forEach(o => {
                // if municipality filter is provided, skip not-matching orders
                if (municipalityId) {
                    const oid = getOrderMunicipalityId(o);
                    if (oid !== municipalityId) return;
                }
            const ts = o.timestamp || o.date || 0;
            const t = typeof ts === 'number' ? ts : (Date.parse(ts) || 0);
            if (!t || t < start) return;
            // only include orders that have items
            (Array.isArray(o.items) ? o.items : []).forEach(it => {
                const key = (it.id !== undefined && it.id !== null) ? String(it.id) : (it.name || 'unknown');
                if (!agg[key]) agg[key] = { name: it.name || ('Item ' + key), qty: 0, revenue: 0 };
                const q = Number(it.quantity) || 0;
                const p = Number(it.price) || 0;
                agg[key].qty += q;
                agg[key].revenue += q * p;
            });
        });

        const list = Object.keys(agg).map(k => ({ key: k, name: agg[k].name, qty: agg[k].qty, revenue: agg[k].revenue }));
        list.sort((a,b) => b.qty - a.qty || b.revenue - a.revenue);

        const top = list.slice(0, 5);
        if (top.length === 0) {
            container.innerHTML = `<div style="color:#888;">No items sold in the last ${rangeDays} days.</div>`;
            return;
        }

        // Build markup
        const rows = top.map((it, idx) => {
            return `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0; border-bottom:1px dashed rgba(255,255,255,0.03);">
                        <div style="display:flex; gap:0.6rem; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:6px; background:rgba(255,255,255,0.03); display:flex; align-items:center; justify-content:center; font-weight:700;">${idx+1}</div>
                            <div style="min-width:160px;">${escapeHtml(it.name)}</div>
                        </div>
                        <div style="color:#bbb; text-align:right; min-width:120px;">
                            <div style="font-weight:700; color:#fff;">${it.qty} pcs</div>
                            <div style="font-size:0.85rem; color:#9b9b9b;">${formatCurrency(it.revenue)}</div>
                        </div>
                    </div>`;
        });

        container.innerHTML = rows.join('');
    } catch (e) {
        console.warn('renderTopItems failed', e);
        container.innerHTML = `<div style="color:#c66;">Error loading top items</div>`;
    }
}

// small HTML-escape helper for item names
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"'`]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[s]);
}

// Order status distribution chart removed — function deleted

// ==========================
// ORDERS MANAGEMENT
// ==========================
function loadOrdersTable(filterStatus) {
    const ordersTable = document.getElementById("orders-table");
    if (!ordersTable) return;
    ordersTable.innerHTML = "";

    if (database.orders.length === 0) {
        ordersTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i>📦</i>
                    <h3>No orders yet</h3>
                    <p>Orders will appear here once customers place them</p>
                </td>
            </tr>`;
        return;
    }

    const sortedOrders = [...database.orders].sort((a, b) => b.timestamp - a.timestamp);

    // If a filterStatus was provided, derive the subset we should display
    let displayOrders = sortedOrders;
    if (filterStatus && filterStatus.toString().trim() !== '' && filterStatus !== 'all') {
        const f = filterStatus.toString().toLowerCase();
        if (f === 'remaining') {
            displayOrders = sortedOrders.filter(o => (o.status||'').toString().toLowerCase() !== 'delivered');
        } else {
            displayOrders = sortedOrders.filter(o => (o.status||'').toString().toLowerCase() === f);
        }
    }

    // Compute simple metrics (based on all orders) and render rows (for displayOrders)
    const metrics = { total: sortedOrders.length, preparing: 0, ontheway: 0, delivered: 0, cancelled: 0 };

    sortedOrders.forEach(order => {
        const status = (order.status || '').toString().toLowerCase();
        if (status === 'preparing') metrics.preparing += 1;
        else if (status === 'on the way' || status === 'ontheway' || status === 'on-the-way') metrics.ontheway += 1;
        else if (status === 'delivered') metrics.delivered += 1;
        else if (status === 'cancelled') metrics.cancelled += 1;
    });

    // Render the rows for the selected displayOrders
    if (displayOrders.length === 0) {
        ordersTable.innerHTML = '<tr><td colspan="8" class="empty-state"><h4 style="margin:0;">No orders found</h4><p style="margin:0.35rem 0 0; color:#bbb;">No orders match the selected filter.</p></td></tr>';
    } else {
        displayOrders.forEach(order => {
            const tr = document.createElement("tr");
            // animate if this was the last-updated order (sessionStorage set briefly)
            const lastUpdatedId = sessionStorage.getItem('lastUpdatedOrder');
            if (lastUpdatedId && lastUpdatedId === order.id) tr.classList.add('row-updated');

            // compute friendly next-status label for the advance button
            const sLower = (order.status || '').toString().toLowerCase();
            const isCancelledOrder = sLower === 'cancelled';
            let nextStatus = 'preparing';
            let nextLabel = 'Preparing';
            if (sLower === 'preparing') { nextStatus = 'on the way'; nextLabel = 'On the Way'; }
            else if (sLower === 'on the way' || sLower === 'ontheway' || sLower === 'on-the-way') { nextStatus = 'delivered'; nextLabel = 'Delivered'; }
            else { nextStatus = 'preparing'; nextLabel = 'Preparing'; }

            const isStaff = !!(currentUser && currentUser.role === 'staff');
            const firstCell = isStaff ? `<td><input type="checkbox" class="order-select" data-id="${order.id}"></td>` : '';
            const itemsHtml = order.items.map(item => item.quantity + 'x ' + item.name).join(", ");
            const paymentHtml = (order.paymentMethod || 'N/A').toString().toUpperCase();
            const statusMeta = (order.statusTimestamps && order.statusTimestamps[order.status]) ? new Date(order.statusTimestamps[order.status]).toLocaleString() : '';
            let statusCell = '';
            if (isStaff) {
                if (isCancelledOrder) {
                    const cancelledBy = order.cancelledBy || '—';
                    const cancelledAt = order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : statusMeta;
                    statusCell = `
                        <td>
                            <div class="status-badge cancelled">Cancelled</div>
                            <div class="status-meta">by ${escapeHtml(cancelledBy)} • ${escapeHtml(cancelledAt)}</div>
                        </td>`;
                } else {
                    statusCell = `
                        <td>
                            <select class="order-status-select" data-id="${order.id}">
                                <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>Preparing</option>
                                <option value="on the way" ${order.status === "on the way" ? "selected" : ""}>On the Way</option>
                                <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>Delivered</option>
                            </select>
                            <div class="status-meta">${statusMeta}</div>
                        </td>`;
                }
            } else {
                statusCell = `<td>${escapeHtml(order.status || '')}</td>`;
            }

            let actionCell = '';
            if (isStaff) {
                if (isCancelledOrder) {
                    actionCell = `
                        <td>
                            <button class="action-btn edit-btn" data-id="${order.id}">View</button>
                            ${order.paymentDetails && order.paymentDetails.gcashProofDataUrl ? ('<button class="action-btn" data-proof="' + order.id + '">Proof</button>') : ""}
                        </td>`;
                } else {
                    // Staff should not be able to cancel orders directly; only view and advance status
                    actionCell = `
                        <td>
                            <button class="action-btn action-advance" title="Advance to ${nextLabel}" data-id="${order.id}" data-next="${nextStatus}">${nextLabel}</button>
                            <button class="action-btn edit-btn" data-id="${order.id}">View</button>
                            ${order.paymentDetails && order.paymentDetails.gcashProofDataUrl ? ('<button class="action-btn" data-proof="' + order.id + '">Proof</button>') : ""}
                        </td>`;
                }
            } else {
                actionCell = `
                    <td>
                        <button class="action-btn edit-btn" data-id="${order.id}">View</button>
                    </td>`;
            }

            tr.innerHTML = `${firstCell}
                <td>${order.id}</td>
                <td>${escapeHtml(order.customer)}</td>
                <td>${escapeHtml(itemsHtml)}</td>
                <td>${formatCurrency(order.total || 0)}</td>
                <td>${escapeHtml(paymentHtml)}</td>
                ${statusCell}
                ${actionCell}`;
            ordersTable.appendChild(tr);
        });
    }

    // Update metrics UI (Remaining = total - delivered)
    try { updateOrderMetrics(metrics); } catch (e) { /* ignore */ }

    document.querySelectorAll(".status-btn").forEach(btn =>
        btn.addEventListener("click", () => updateOrderStatus(btn.dataset.id))
    );

    // Auto-save when status select changes (reduce clicks)
    document.querySelectorAll('.order-status-select').forEach(sel => {
        sel.addEventListener('change', () => updateOrderStatus(sel.dataset.id));
    });

    // Advance single order status (one-click) - now uses .action-advance buttons
    document.querySelectorAll('.action-advance').forEach(btn =>
        btn.addEventListener('click', () => advanceOrderStatus(btn.dataset.id))
    );

    // Cancel single order (staff/admin)
    document.querySelectorAll('.action-cancel').forEach(btn =>
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const ok = await showConfirm(`Cancel order ${id}? This cannot be undone.`);
            if (!ok) return;
            try {
                if (typeof cancelOrder === 'function') cancelOrder(id, (currentUser && currentUser.email) || 'staff');
            } catch (e) { console.warn('cancelOrder failed', e); }
        })
    );

    // Selection checkboxes
    const selectAll = document.getElementById('select-all-orders');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.addEventListener('change', () => {
            document.querySelectorAll('.order-select').forEach(cb => cb.checked = selectAll.checked);
        });
    }

    document.querySelectorAll('.order-select').forEach(cb => cb.addEventListener('change', () => {
        // If any checkbox is unchecked, uncheck select-all
        const all = document.querySelectorAll('.order-select');
        const checked = document.querySelectorAll('.order-select:checked');
        if (selectAll) selectAll.checked = (all.length === checked.length && all.length > 0);
    }));

    // Bulk action buttons
    const bulkPreparing = document.getElementById('bulk-preparing');
    const bulkOntheway = document.getElementById('bulk-ontheway');
    const bulkDelivered = document.getElementById('bulk-delivered');

    if (bulkPreparing) bulkPreparing.addEventListener('click', async () => {
        const ok = await showConfirm('Mark selected orders as Preparing?');
        if (!ok) return; bulkUpdateSelected('preparing');
    });
    if (bulkOntheway) bulkOntheway.addEventListener('click', async () => {
        const ok = await showConfirm('Mark selected orders as On the Way?');
        if (!ok) return; bulkUpdateSelected('on the way');
    });
    if (bulkDelivered) bulkDelivered.addEventListener('click', async () => {
        const ok = await showConfirm('Mark selected orders as Delivered?');
        if (!ok) return; bulkUpdateSelected('delivered');
    });

    document.querySelectorAll(".edit-btn").forEach(btn =>
        btn.addEventListener("click", () => viewOrderDetails(btn.dataset.id))
    );

    // View proof buttons
    document.querySelectorAll('[data-proof]').forEach(btn => {
        btn.addEventListener('click', () => viewPaymentProof(btn.getAttribute('data-proof')));
    });

}

function updateOrderStatus(orderId) {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return;
    const statusSelect = document.querySelector(`.order-status-select[data-id="${orderId}"]`);
    if (!statusSelect) return;

    const newStatus = statusSelect.value;
    order.status = newStatus;
    // record timestamp for this status for audit/UX
    order.statusTimestamps = order.statusTimestamps || {};
    order.statusTimestamps[newStatus] = Date.now();
    // remember last-updated order to animate row once
    sessionStorage.setItem('lastUpdatedOrder', orderId);
    localStorage.setItem("orders", JSON.stringify(database.orders));
    showNotification(`Order ${orderId} updated to ${order.status}`);
    loadOrdersTable();
    sendStatusUpdateEmail(order);
}

// Advance order status to the next logical step
function advanceOrderStatus(orderId) {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return;
    const s = (order.status || '').toString().toLowerCase();
    if (s === 'preparing') order.status = 'on the way';
    else if (s === 'on the way' || s === 'ontheway' || s === 'on-the-way') order.status = 'delivered';
    else order.status = 'preparing';
    order.statusTimestamps = order.statusTimestamps || {};
    order.statusTimestamps[order.status] = Date.now();
    sessionStorage.setItem('lastUpdatedOrder', orderId);
    localStorage.setItem('orders', JSON.stringify(database.orders));
    showNotification(`Order ${orderId} advanced to ${order.status}`);
    loadOrdersTable();
    sendStatusUpdateEmail(order);
}

// Bulk update selected orders to a status
function bulkUpdateSelected(status) {
    const checked = Array.from(document.querySelectorAll('.order-select:checked')).map(cb => cb.dataset.id);
    if (checked.length === 0) return showNotification('No orders selected for bulk update', 'error');
    checked.forEach(id => {
        const o = database.orders.find(x => x.id === id);
        if (o) {
            o.status = status;
            o.statusTimestamps = o.statusTimestamps || {};
            o.statusTimestamps[status] = Date.now();
        }
    });
    localStorage.setItem('orders', JSON.stringify(database.orders));
    showNotification(`Updated ${checked.length} order(s) to '${status}'`);
    // animate the last updated row
    if (checked.length > 0) sessionStorage.setItem('lastUpdatedOrder', checked[checked.length-1]);
    loadOrdersTable();
    // Optionally notify per-order (lightweight)
    checked.forEach(id => {
        const o = database.orders.find(x => x.id === id);
        if (o) sendStatusUpdateEmail(o);
    });
}

// Update the metrics shown in the admin panel
function updateOrderMetrics(metrics) {
    const totalEl = document.getElementById('total-orders');
    const prepEl = document.getElementById('preparing-count');
    const onEl = document.getElementById('ontheway-count');
    const delEl = document.getElementById('delivered-count');
    const remEl = document.getElementById('remaining-count');

    if (totalEl) totalEl.textContent = metrics.total || 0;
    if (prepEl) prepEl.textContent = metrics.preparing || 0;
    if (onEl) onEl.textContent = metrics.ontheway || 0;
    if (delEl) delEl.textContent = metrics.delivered || 0;
    if (remEl) remEl.textContent = (metrics.total - (metrics.delivered || 0)) || 0;
}

function viewOrderDetails(orderId) {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return;
    // Populate and show the order details modal instead of alert()
    const modal = document.getElementById('order-detail-modal');
    const body = document.getElementById('order-detail-body');
    if (!modal || !body) {
        // Modal markup missing — avoid using blocking alert() and fail silently with a console warning
        console.warn('Order details modal not found. Skipping display for order', orderId);
        return;
    }

    const lines = [];
    lines.push(`<strong>Order ID:</strong> ${order.id}`);
    lines.push(`<strong>Customer:</strong> ${order.customer}`);
    if (order.customerEmail) lines.push(`<strong>Email:</strong> ${order.customerEmail}`);
    if (order.deliveryAddress) lines.push(`<strong>Address:</strong> ${order.deliveryAddress}`);
    lines.push(`<strong>Total:</strong> ${formatCurrency(order.total||0)}`);
    lines.push(`<strong>Status:</strong> ${order.status || 'N/A'}`);
    if ((order.status||'').toString().toLowerCase() === 'cancelled') {
        lines.push(`<strong>Cancelled By:</strong> ${escapeHtml(order.cancelledBy || '—')}`);
        if (order.cancelledAt) lines.push(`<strong>Cancelled At:</strong> ${new Date(order.cancelledAt).toLocaleString()}`);
    }
    lines.push(`<strong>Payment:</strong> ${(order.paymentMethod || 'N/A').toString().toUpperCase()}`);
    if (order.paymentMethod === 'gcash') {
        const ref = order.paymentDetails?.referenceNo || '-';
        lines.push(`<strong>GCash Ref:</strong> ${ref}`);
        if (order.paymentDetails?.gcashProofDataUrl) lines.push(`<em>Payment proof attached</em>`);
    }

    // Items
    lines.push('<hr />');
    lines.push('<strong>Items</strong>');
    lines.push('<ul>');
    order.items.forEach(i => {
        lines.push(`<li>${i.quantity}x ${i.name} — ${formatCurrency(i.price * i.quantity)}</li>`);
    });
    lines.push('</ul>');

    body.innerHTML = lines.join('');
    openModal(modal);

    // wire close button inside modal (ok button and close X) — they will be cleaned up by existing modal handlers
    const ok = document.getElementById('order-detail-ok');
    const closeX = document.getElementById('order-detail-close');
    if (ok) ok.onclick = () => { modal.style.display = 'none'; };
    if (closeX) closeX.onclick = () => { modal.style.display = 'none'; };
}

function viewPaymentProof(orderId) {
    const order = database.orders.find(o => o.id === orderId);
    if (!order || !order.paymentDetails || !order.paymentDetails.gcashProofDataUrl) {
        return showNotification('No proof attached for this order', 'error');
    }
    const modal = document.getElementById('proof-modal');
    const img = document.getElementById('proof-img');
    const meta = document.getElementById('proof-meta');
    if (!modal || !img) return;
    img.src = order.paymentDetails.gcashProofDataUrl;
    meta.textContent = `Method: ${(order.paymentMethod||'').toUpperCase()}${order.paymentDetails.referenceNo ? ` • Ref: ${order.paymentDetails.referenceNo}` : ''}`;
    openModal(modal);
}

function loadMenuItemsTable() {
    const table = document.getElementById("menu-items-table");
    if (!table) return;
    table.innerHTML = "";

    if (database.menuItems.length === 0) {
        table.innerHTML = `<tr><td colspan="5" class="empty-state">No menu items found</td></tr>`;
        return;
    }

    database.menuItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image}" alt="${item.name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" onerror="this.src='images/logo.png'"></td>
            <td>${item.name}</td>
            <td>${item.description}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${item.category}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${item.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${item.id}">Delete</button>
            </td>`;
        table.appendChild(tr);
    });

    document.querySelectorAll("#menu-items-table .edit-btn").forEach(btn =>
        btn.addEventListener("click", () => editMenuItem(parseInt(btn.dataset.id)))
    );
    document.querySelectorAll("#menu-items-table .delete-btn").forEach(btn =>
        btn.addEventListener("click", () => deleteMenuItem(parseInt(btn.dataset.id)))
    );

    const addMenuBtn = document.getElementById("add-menu-item");
    if (addMenuBtn) addMenuBtn.addEventListener("click", addMenuItem);
}

// Load users table with optional role filter (e.g., 'staff', 'admin', 'customer', or 'all')
function loadUsersTable(roleFilter) {
    const table = document.getElementById("users-table");
    if (!table) return;
    table.innerHTML = "";

    let usersList = Array.isArray(database.users) ? [...database.users] : [];
    if (!usersList || usersList.length === 0) {
        table.innerHTML = `<tr><td colspan="4" class="empty-state">No users found</td></tr>`;
        return;
    }

    if (roleFilter && roleFilter.toString().toLowerCase() !== 'all') {
        const rf = roleFilter.toString().toLowerCase();
        usersList = usersList.filter(u => (u.role||'').toString().toLowerCase() === rf);
    }

    if (usersList.length === 0) {
        table.innerHTML = `<tr><td colspan="4" class="empty-state">No users found for '${roleFilter}'</td></tr>`;
        return;
    }

    usersList.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${user.id}">Edit</button>
                <button class="action-btn delete-btn" data-id="${user.id}">Delete</button>
            </td>`;
        table.appendChild(tr);
    });

    document.querySelectorAll("#users-table .edit-btn").forEach(btn =>
        btn.addEventListener("click", () => editUser(parseInt(btn.dataset.id)))
    );
    document.querySelectorAll("#users-table .delete-btn").forEach(btn =>
        btn.addEventListener("click", () => deleteUser(parseInt(btn.dataset.id)))
    );
}

function saveMenuItems() {
    localStorage.setItem("menuItems", JSON.stringify(database.menuItems));
}

function addMenuItem() {
    const modal = document.getElementById("edit-menu-modal");
    const form = document.getElementById("edit-menu-form");
    if (!modal || !form) return;

    form.reset();
    document.getElementById("edit-item-id").value = "";
    modal.style.display = "block";
    // preview handler
    const fileInput = document.getElementById('edit-item-image-file');
    const previewImg = document.getElementById('edit-item-image-preview-img');
    if (fileInput) {
        fileInput.value = '';
        fileInput.onchange = () => {
            const f = fileInput.files && fileInput.files[0];
            if (!f) { previewImg.style.display = 'none'; previewImg.src = ''; return; }
            const reader = new FileReader();
            reader.onload = () => { previewImg.src = reader.result; previewImg.style.display = 'block'; };
            reader.readAsDataURL(f);
        };
    }

    form.onsubmit = async e => {
        e.preventDefault();

        // determine image: file takes precedence over URL
        let imageUrl = document.getElementById("edit-item-image").value.trim();
        const file = (document.getElementById('edit-item-image-file') || {}).files && document.getElementById('edit-item-image-file').files[0];
        if (file) {
            try {
                imageUrl = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = rej;
                    r.readAsDataURL(file);
                });
            } catch (e) { console.warn('Failed reading image file', e); }
        }

        const newItem = {
            id: Date.now(),
            name: document.getElementById("edit-item-name").value.trim() || "New Burger",
            description: document.getElementById("edit-item-description").value.trim() || "Delicious new burger",
            price: parseFloat(document.getElementById("edit-item-price").value) || 9.99,
            category: document.getElementById("edit-item-category").value.trim() || "burgers",
            image: imageUrl || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"
        };

        database.menuItems.push(newItem);
        saveMenuItems();
        loadMenuItemsTable();
        showNotification("New menu item added successfully!");
        modal.style.display = "none";
    };
}

function editMenuItem(id) {
    const modal = document.getElementById("edit-menu-modal");
    const form = document.getElementById("edit-menu-form");
    if (!modal || !form) return;

    const item = database.menuItems.find(i => i.id === id);
    if (!item) return showNotification("Item not found", "error");

    document.getElementById("edit-item-id").value = item.id;
    document.getElementById("edit-item-name").value = item.name;
    document.getElementById("edit-item-description").value = item.description;
    document.getElementById("edit-item-price").value = item.price;
    document.getElementById("edit-item-category").value = item.category;
    document.getElementById("edit-item-image").value = item.image;
    const previewImg = document.getElementById('edit-item-image-preview-img');
    if (previewImg) { previewImg.src = item.image || ''; previewImg.style.display = item.image ? 'block' : 'none'; }

    modal.style.display = "block";

    // wire file input preview
    const fileInput = document.getElementById('edit-item-image-file');
    if (fileInput) {
        fileInput.value = '';
        fileInput.onchange = () => {
            const f = fileInput.files && fileInput.files[0];
            if (!f) { previewImg.style.display = 'none'; previewImg.src = ''; return; }
            const reader = new FileReader();
            reader.onload = () => { previewImg.src = reader.result; previewImg.style.display = 'block'; };
            reader.readAsDataURL(f);
        };
    }

    form.onsubmit = async e => {
        e.preventDefault();

        // If a file is selected, read it and use dataURL. Otherwise use the URL input.
        let imageVal = document.getElementById("edit-item-image").value.trim();
        const file = (document.getElementById('edit-item-image-file') || {}).files && document.getElementById('edit-item-image-file').files[0];
        if (file) {
            try {
                imageVal = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = rej;
                    r.readAsDataURL(file);
                });
            } catch (e) { console.warn('Failed reading image file', e); }
        }

        item.name = document.getElementById("edit-item-name").value.trim();
        item.description = document.getElementById("edit-item-description").value.trim();
        item.price = parseFloat(document.getElementById("edit-item-price").value);
        item.category = document.getElementById("edit-item-category").value.trim();
        item.image = imageVal;

        saveMenuItems();
        loadMenuItemsTable();
        showNotification("Menu item updated successfully!");
        modal.style.display = "none";
    };
}

async function deleteMenuItem(id) {
    const ok = await showConfirm('Delete this menu item?');
    if (!ok) return;
    database.menuItems = database.menuItems.filter(i => i.id !== id);
    saveMenuItems();
    loadMenuItemsTable();
    showNotification('Menu item deleted');
}

// Allow filtering users by role from the users tab
function setupUsersFilter() {
        const pillContainer = document.getElementById('users-role-pills');
        const clearBtn = document.getElementById('clear-users-filter');
        if (!pillContainer) {
            loadUsersTable();
            return;
        }

        const pills = Array.from(pillContainer.querySelectorAll('.user-pill'));
        const saved = sessionStorage.getItem('usersFilter') || 'all';

        // set active pill according to saved value
        pills.forEach(p => p.classList.toggle('active', p.dataset.role === saved));
        loadUsersTable(saved);

        pills.forEach(p => p.addEventListener('click', () => {
            const role = p.dataset.role || 'all';
            const wasActive = p.classList.contains('active');
            // clear all
            pills.forEach(x => x.classList.remove('active'));
            if (!wasActive) {
                p.classList.add('active');
                sessionStorage.setItem('usersFilter', role);
                loadUsersTable(role);
            } else {
                // toggle off -> show all
                sessionStorage.removeItem('usersFilter');
                loadUsersTable();
            }
        }));

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                pills.forEach(x => x.classList.remove('active'));
                const allPill = pillContainer.querySelector('.user-pill[data-role="all"]');
                if (allPill) allPill.classList.add('active');
                sessionStorage.removeItem('usersFilter');
                loadUsersTable();
            });
        }
    }

function saveUsers() {
    localStorage.setItem("users", JSON.stringify(database.users));
}

function editUser(userId) {
    const modal = document.getElementById("add-user-modal");
    const form = document.getElementById("add-user-form");
    const user = database.users.find(u => u.id === userId);
    if (!modal || !form || !user) return;

    modal.style.display = "block";
    form.reset();
    document.getElementById("user-name-input").value = user.name;
    document.getElementById("user-email-input").value = user.email;
    document.getElementById("user-password-input").value = "";
    document.getElementById("user-role-input").value = user.role;

    let hidden = document.getElementById("edit-user-id");
    if (!hidden) {
        hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.id = "edit-user-id";
        form.appendChild(hidden);
    }
    hidden.value = user.id;

    form.onsubmit = e => {
        e.preventDefault();
        user.name = document.getElementById("user-name-input").value.trim();
        user.email = document.getElementById("user-email-input").value.trim();
        const pass = document.getElementById("user-password-input").value;
        if (pass) user.password = pass;
        user.role = document.getElementById("user-role-input").value;

        saveUsers();
        loadUsersTable();
        showNotification("User updated successfully!");
        modal.style.display = "none";
    };
}

async function deleteUser(userId) {
    if (currentUser && currentUser.id === userId)
        return showNotification("You cannot delete your own account", "error");

    const ok = await showConfirm('Delete this user?');
    if (!ok) return;
    database.users = database.users.filter(u => u.id !== userId);
    saveUsers();
    loadUsersTable();
    showNotification('User deleted');
}

// ==========================
// ADD USER MODAL
// ==========================
function setupAddUserModal() {
    const addUserBtn = document.getElementById("add-user-btn");
    const modal = document.getElementById("add-user-modal");
    const form = document.getElementById("add-user-form");
    if (!addUserBtn || !modal || !form) return;

    addUserBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        modal.style.display = "block";
        form.reset();
        const hidden = document.getElementById("edit-user-id");
        if (hidden) hidden.remove();
    });

    form.onsubmit = e => {
        e.preventDefault();

        const editIdEl = document.getElementById("edit-user-id");
        const editId = editIdEl ? parseInt(editIdEl.value) : null;

        const userData = {
            name: document.getElementById("user-name-input").value.trim(),
            email: document.getElementById("user-email-input").value.trim(),
            password: document.getElementById("user-password-input").value.trim(),
            role: document.getElementById("user-role-input").value
        };

        if (editId) {
            const idx = database.users.findIndex(u => u.id === editId);
            if (idx === -1) return showNotification("User not found", "error");
            Object.assign(database.users[idx], userData);
            showNotification("User updated successfully!");
        } else {
            const newUser = { id: Date.now(), ...userData };
            database.users.push(newUser);
            showNotification("User added successfully!");
        }

        saveUsers();
        loadUsersTable();
        modal.style.display = "none";
    };
}

// ==========================
// GLOBAL MODAL HANDLING
// ==========================
function setupAdminTabs() {
    const tabs = document.querySelectorAll(".admin-tab");
    const contents = document.querySelectorAll(".admin-content");
    if (tabs.length > 0) tabs[0].classList.add("active");
    if (contents.length > 0) contents[0].classList.add("active");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            const target = document.getElementById(`${tab.dataset.tab}-content`);
            if (target) target.classList.add("active");
            // refresh dashboard when opened
            try {
                if (tab.dataset.tab === 'dashboard') updateAdminDashboardMetrics();
                else if (tab.dataset.tab === 'orders') loadOrdersTable();
                else if (tab.dataset.tab === 'menu-items') loadMenuItemsTable();
                else if (tab.dataset.tab === 'users') loadUsersTable();
            } catch (e) { /* ignore */ }
        });
    });

    // ✅ Close button: only closes its own modal
    document.querySelectorAll(".close").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            const modal = btn.closest(".modal");
            if (modal) modal.style.display = "none";
        });
    });

    // ✅ Click outside modal closes it
    window.addEventListener("click", e => {
        const modals = document.querySelectorAll(".modal");
        modals.forEach(m => {
            if (e.target === m) m.style.display = "none";
        });
    });
}

// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    loadAdminData();
    setupAdminTabs();
    setupAddUserModal();
    setupLocationTabs();
    // Ensure panels are populated first so the picker can read clean labels
    try { populateAllMunicipalityPanels(); } catch (e) { /* non-fatal */ }
    setupLocationSelect();
    setupLocationSearch();
    setupMetricFilters();
    setupUsersFilter();
    // ensure a default panel is shown (the one already marked .location-active or the first)
    try {
        const active = document.querySelector('.location-grid.location-active');
        if (active) {
            const id = active.id || (document.querySelector('.location-grid') || {}).id;
            if (id) showMunicipality(id, active.dataset.label || id.replace(/-/g, ' '));
        } else {
            const first = document.querySelector('.location-grid');
            if (first && first.id) showMunicipality(first.id, first.dataset.label || first.id.replace(/-/g, ' '));
        }
    } catch (e) { /* ignore */ }
});

// Build a searchable picker UI that mirrors the options in #location-select
function setupLocationSearch() {
    const mount = document.getElementById('location-picker');
    const sel = document.getElementById('location-select');
    if (!mount) return;

    // Create picker DOM
    mount.innerHTML = `
        <div class="custom-location-picker" id="__loc_picker_inner">
            <input id="location-search" class="custom-location-input" placeholder="Search municipality..." autocomplete="off" />
            <span class="custom-location-trigger">▾</span>
            <div class="custom-location-list hidden" id="location-results" role="listbox"></div>
        </div>`;

    const input = document.getElementById('location-search');
    const results = document.getElementById('location-results');
    const options = getLocationOptions();

    function renderList(filter = '') {
        const f = (filter || '').toString().trim().toLowerCase();
        results.innerHTML = '';
        const list = options.filter(o => o.label.toLowerCase().includes(f) || o.value.includes(f));
        if (list.length === 0) {
            results.innerHTML = `<div class="custom-location-empty">No results</div>`;
            results.classList.remove('hidden');
            return;
        }
        list.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'custom-location-item';
            div.tabIndex = 0;
            div.dataset.value = opt.value;
            div.textContent = opt.label;
            div.addEventListener('click', () => {
                // If native select exists, keep it in sync for compatibility
                if (sel) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change'));
                } else {
                    // show the panel programmatically
                    showMunicipality(opt.value, opt.label);
                }
                input.value = opt.label;
                results.classList.add('hidden');
            });
            results.appendChild(div);
        });
        results.classList.remove('hidden');
    }

    input.addEventListener('input', (e) => renderList(e.target.value));
    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
        const items = Array.from(results.querySelectorAll('.custom-location-item'));
        if (items.length === 0) return;
        let idx = items.findIndex(it => it.classList.contains('active'));
            if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < items.length - 1) idx++; else idx = 0;
            items.forEach(it => it.classList.remove('active'));
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) idx--; else idx = items.length - 1;
            items.forEach(it => it.classList.remove('active'));
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selItem = items[idx > -1 ? idx : 0];
            if (selItem) {
                const val = selItem.dataset.value;
                const labelText = selItem.textContent;
                if (sel) {
                    sel.value = val;
                    sel.dispatchEvent(new Event('change'));
                } else {
                    showMunicipality(val, labelText);
                }
                input.value = labelText;
                results.classList.add('hidden');
            }
        } else if (e.key === 'Escape') {
            results.classList.add('hidden');
        }
    });

    // click outside closes the list
    document.addEventListener('click', (e) => {
        const inner = document.getElementById('__loc_picker_inner');
        if (!inner) return;
        if (!inner.contains(e.target)) {
            results.classList.add('hidden');
        }
    });

    // initialize with selected option text (or first option from derived list)
    if (sel && sel.options && sel.options[sel.selectedIndex]) {
        input.value = sel.options[sel.selectedIndex].text;
    } else {
        const opt = getLocationOptions()[0];
        if (opt) input.value = opt.label;
    }
}

// Helper: gather municipality options from the native select if present,
// otherwise derive them from the existing panels in the DOM.
function getLocationOptions() {
    const sel = document.getElementById('location-select');
    if (sel) return Array.from(sel.options).map(o => ({ value: o.value, label: o.text }));
    const panels = Array.from(document.querySelectorAll('.location-grid')) || [];
    // helper: title-case a label for nicer display
    const titleCase = s => s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return panels.map(p => {
        const id = p.id || '';
        // prefer explicit data-label set by populateAllMunicipalityPanels
        let label = (p.dataset && p.dataset.label) ? p.dataset.label.trim() : '';
        if (!label) {
            // try to find a readable node and sanitize it
            const lblEl = p.querySelector('.small-meta.muted, .muted, .hero-label, h4, h3');
            if (lblEl) {
                label = lblEl.textContent.trim();
                // remove trailing em-dash fragments like " — sample data not loaded."
                if (label.indexOf('—') !== -1) label = label.split('—')[0].trim();
                // strip common prefixes like "Total Orders in"
                label = label.replace(/^total orders in\s+/i, '');
                // if still too long or contains 'sample data', fallback to id
                if (label.length === 0 || /sample data/i.test(label) || label.length > 60) label = '';
            }
        }
        if (!label) label = id.replace(/-/g, ' ');
        return { value: id, label: titleCase(label) };
    }).filter(o => o.value);
}

// Centralized: show a municipality panel by id and render metrics
function showMunicipality(targetValue, label) {
    const panels = document.querySelectorAll('.location-grid');
    // add exit class to currently active panel so it animates out
    panels.forEach(p => {
        if (p.classList.contains('location-active')) {
            p.classList.add('panel-exit');
            // remove active after animation
            setTimeout(() => {
                p.classList.remove('panel-exit');
                p.classList.add('hidden');
                p.classList.remove('location-active');
            }, 260);
        } else {
            p.classList.add('hidden');
            p.classList.remove('location-active');
        }
    });
    const panel = document.getElementById(targetValue);
    if (panel) {
        // prepare and show with enter animation
        panel.classList.remove('hidden');
        panel.classList.add('panel-enter');
        setTimeout(() => panel.classList.remove('panel-enter'), 360);
        panel.classList.add('location-active');
        try {
            // ensure template content exists inside panel
            const templ = document.getElementById('municipality-template');
            if (templ && templ.content && !panel.querySelector('[data-metric]')) {
                panel.innerHTML = '';
                const clone = templ.content.cloneNode(true);
                clone.querySelectorAll('[data-metric]').forEach(el => {
                    const key = el.getAttribute('data-metric');
                    if (key === 'label' || key === 'label2') el.textContent = label || (targetValue || '').replace(/-/g, ' ');
                });
                panel.appendChild(clone);
            }
            renderMunicipalityPanel(targetValue, label || (targetValue || '').replace(/-/g, ' '));
            // update charts and top-items scoped to this municipality
            try { const days = getCurrentChartRange(); drawSalesChart(days, targetValue); } catch (e) { /* ignore */ }
            try { const days = getCurrentChartRange(); renderTopItems(days, targetValue); } catch (e) { /* ignore */ }
        } catch (e) { console.warn('showMunicipality -> renderMunicipalityPanel failed', e); }
    }
}

// utility to find current chart range (7/14/30) from active button
function getCurrentChartRange() {
    const activeBtn = document.querySelector('.chart-range-btn.active');
    if (activeBtn) return parseInt(activeBtn.dataset.days, 10) || 7;
    return 7;
}

// Clone the hidden municipality template into every panel that is currently a placeholder
function populateAllMunicipalityPanels() {
    const templ = document.getElementById('municipality-template');
    if (!templ || !templ.content) return;
    const sel = document.getElementById('location-select');
    // Map option value -> display text for label population
    const labelMap = {};
    if (sel) Array.from(sel.options).forEach(opt => { labelMap[opt.value] = opt.text; });

    const panels = document.querySelectorAll('.location-grid');
    console.debug('populateAllMunicipalityPanels: found', panels.length, 'panels, template?', !!templ);
    panels.forEach(panel => {
        // if the panel already contains the rich layout, skip
        const hasRich = panel.querySelector('.location-top') || panel.querySelector('.location-mid') || panel.querySelector('.location-hero');
        // always ensure panel has data-label for picker; compute from labelMap or id
    const panelId = panel.id || '';
    const derivedLabel = (labelMap[panelId] || panelId.replace(/-/g, ' ')).trim();
    panel.dataset.label = derivedLabel;
        if (hasRich) return;

        // clear and clone
    const id = panelId;
        panel.innerHTML = '';
        const clone = templ.content.cloneNode(true);
        clone.querySelectorAll('[data-metric]').forEach(el => {
            const key = el.getAttribute('data-metric');
            if (key === 'label' || key === 'label2') {
                el.textContent = derivedLabel;
            }
        });
        panel.appendChild(clone);
    console.debug('populateAllMunicipalityPanels: populated panel', id || '(no-id)');
        // populate live numbers immediately for the cloned panel
    try { renderMunicipalityPanel(id, derivedLabel); } catch (e) { console.warn('failed to render metrics for', id, e); }
    });
}

// Setup click handlers for the municipality/location tabs inside the dashboard
function setupLocationTabs() {
    const tabs = document.querySelectorAll('.location-tab');
    if (!tabs || tabs.length === 0) return;
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // deactivate all
            tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            const panels = document.querySelectorAll('.location-grid');
            panels.forEach(p => { p.classList.add('hidden'); p.classList.remove('location-active'); });

            // activate clicked
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const targetId = tab.dataset.target;
            if (!targetId) return;
            const panel = document.getElementById(targetId);
            if (panel) { panel.classList.remove('hidden'); panel.classList.add('location-active'); }
        });
    });
}

// Setup select dropdown to switch municipality panels (compact for many items)
function setupLocationSelect() {
    const sel = document.getElementById('location-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
        const target = sel.value;
        const label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : target;
        // Delegate to showMunicipality which handles template cloning and animation
        try { showMunicipality(target, label); } catch (e) { console.warn('showMunicipality failed', e); }
    });
    // trigger initial selection to show the default panel and render it
    const initial = sel.value;
    if (initial) {
        const label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : initial;
        try { showMunicipality(initial, label); } catch (e) { /* ignore */ }
    }
}

// Normalize a municipality/city name into the select value format used in the DOM
function normalizeMunicipalityName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

// Helper: determine the municipality id for an order.
// Prefer an explicit `order.municipality` (set at checkout). Fall back to parsing deliveryAddress
// for historical orders that don't have the field.
function getOrderMunicipalityId(order) {
    if (!order) return '';
    if (order.municipality && typeof order.municipality === 'string' && order.municipality.trim() !== '') {
        return order.municipality;
    }
    // fallback: parse deliveryAddress like before
    let cityPart = '';
    if (order.deliveryAddress) {
        const parts = order.deliveryAddress.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) cityPart = parts[parts.length - 2];
        else if (parts.length === 1) cityPart = parts[0];
    }
    return normalizeMunicipalityName(cityPart);
}

// Compute aggregated metrics for a municipality id (matches select option values like 'mabini' or 'batangas-city')
function computeMunicipalityMetrics(municipalityId) {
    const orders = Array.isArray(database.orders) ? database.orders : [];
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    let totalOrders = 0;
    let newOrders = 0; // last 30 days
    let totalQuantity = 0;
    let totalQuantityAll = 0;
    let revenue = 0; // sum of completed/delivered orders for this municipality
    let revenueAll = 0;

    orders.forEach(o => {
        // Determine municipality id for this order (prefer explicit field, fallback to address parsing)
        const oid = getOrderMunicipalityId(o);
        const matches = (oid === (municipalityId || ''));

        // quantity aggregation (use item quantities across all orders for percent denominator)
        const items = Array.isArray(o.items) ? o.items : [];
        items.forEach(it => { totalQuantityAll += Number(it.quantity) || 0; });

        if (matches) {
            totalOrders += 1;
            if ((now - (o.timestamp || 0)) <= THIRTY_DAYS) newOrders += 1;
            items.forEach(it => { totalQuantity += Number(it.quantity) || 0; });
            const status = (o.status || '').toString().toLowerCase();
            if (status === 'delivered' || status === 'completed') {
                revenue += Number(o.total) || 0;
            }
        }

        // revenueAll (only count completed/delivered for overall comparison)
        const s = (o.status || '').toString().toLowerCase();
        if (s === 'delivered' || s === 'completed') revenueAll += Number(o.total) || 0;
    });

    const quantityPercent = totalQuantityAll > 0 ? (totalQuantity / totalQuantityAll) * 100 : 0;

    return {
        totalOrders,
        newOrders,
        totalQuantity,
        totalQuantityAll,
        quantityPercent,
        revenue,
        revenueAll,
        // Profit cannot be computed exactly without cost data; provide a conservative estimate (30% margin) as a placeholder
        profitEstimate: revenue * 0.30
    };
}

// Render the municipality metric template inside the panel element and populate it with live numbers
function renderMunicipalityPanel(panelId, displayName) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const m = computeMunicipalityMetrics(panelId);

    // Always prefer cloning the template (if available) so panels are consistent.

    // Build a compact template (keeps the same visual arrangement as the original Mabini sample)
    // Prefer cloning from the <template id="municipality-template"> when available
    const templ = document.getElementById('municipality-template');
    if (templ && templ.content) {
        // clear existing panel and append cloned template (force-replace handcrafted content)
        panel.innerHTML = '';
        const clone = templ.content.cloneNode(true);
        // populate clone fields
        clone.querySelectorAll('[data-metric]').forEach(el => {
            const key = el.getAttribute('data-metric');
            if (key === 'label' || key === 'label2') {
                el.textContent = displayName;
            } else if (key === 'totalOrders') {
                el.textContent = String(m.totalOrders);
            } else if (key === 'newOrders') {
                el.textContent = String(m.newOrders);
            } else if (key === 'quantity') {
                el.textContent = String(m.totalQuantity);
            } else if (key === 'quantityPercent') {
                el.textContent = `(${m.quantityPercent.toFixed(1)}%)`;
            } else if (key === 'revenue') {
                el.textContent = formatCurrency(m.revenue);
            } else if (key === 'profitEstimate') {
                el.textContent = formatCurrency(m.profitEstimate);
            }
        });
        panel.appendChild(clone);
        return;
    }

    panel.innerHTML = `
        <div class="location-top" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="location-stat">
                <div class="small-meta">New (30d)</div>
                <div class="big-num" id="${panelId}-total-orders">${m.totalOrders}</div>
                <div class="small-meta muted">Total Orders in ${escapeHtml(displayName)}</div>
            </div>
            <div class="location-stat">
                <div class="small-meta">Last 30 days</div>
                <div class="big-num" id="${panelId}-new-orders">${m.newOrders}</div>
                <div class="small-meta muted">New Orders</div>
            </div>
        </div>

        <div class="location-mid" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
            <div class="location-compact">
                <div class="compact-title">Quantity</div>
                <div class="compact-value">${m.totalQuantity}<span class="percent"> (${m.quantityPercent.toFixed(1)}%)</span></div>
            </div>
            <div class="location-compact">
                <div class="compact-title">Revenue (completed)</div>
                <div class="compact-value">${formatCurrency(m.revenue)}</div>
            </div>
        </div>

        <div class="location-hero" style="text-align:center; margin-top:1.5rem; padding:1.5rem 0;">
            <div class="hero-circle" aria-hidden="true">💰</div>
            <div class="hero-label">Estimated Profit (${escapeHtml(displayName)})</div>
            <div style="margin-top:0.5rem; font-weight:700;">${formatCurrency(m.profitEstimate)}</div>
        </div>
    `;
}

// ==========================
// ADMIN-ONLY ORDER UTILITIES
// ==========================
function setupOrderAdminActions() {
    const clearBtn = document.getElementById("clear-orders-btn");
    if (!clearBtn) return;
    // Only staff can clear all orders in this configuration; hide for admins and others
    const isStaff = !!(currentUser && currentUser.role === 'staff');
    if (!isStaff) {
        clearBtn.style.display = "none";
    } else {
        clearBtn.addEventListener("click", async () => {
            const ok = await showConfirm("Clear all orders? This cannot be undone.");
            if (!ok) return;
            database.orders = [];
            localStorage.setItem("orders", JSON.stringify(database.orders));
            loadOrdersTable();
            showNotification("All orders cleared");
        });
    }

    // Hide bulk management controls (select-all + bulk action buttons) for non-staff users
    const bulkPreparing = document.getElementById('bulk-preparing');
    const bulkOntheway = document.getElementById('bulk-ontheway');
    const bulkDelivered = document.getElementById('bulk-delivered');
    const selectAll = document.getElementById('select-all-orders');
    if (!isStaff) {
        if (bulkPreparing) bulkPreparing.style.display = 'none';
        if (bulkOntheway) bulkOntheway.style.display = 'none';
        if (bulkDelivered) bulkDelivered.style.display = 'none';
        if (selectAll) selectAll.style.display = 'none';
    }
}

// Reusable confirmation modal that returns a Promise<boolean>
function showConfirm(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const msg = document.getElementById('confirm-message');
        const yes = document.getElementById('confirm-yes');
        const no = document.getElementById('confirm-cancel');
        const close = document.getElementById('confirm-close');
        if (!modal || !msg || !yes || !no) return resolve(false);

        msg.textContent = message;
        openModal(modal);

        const cleanup = () => {
            modal.style.display = 'none';
            yes.removeEventListener('click', onYes);
            no.removeEventListener('click', onNo);
            close.removeEventListener('click', onNo);
        };

        const onYes = () => { cleanup(); resolve(true); };
        const onNo = () => { cleanup(); resolve(false); };

        yes.addEventListener('click', onYes);
        no.addEventListener('click', onNo);
        close.addEventListener('click', onNo);
    });
}

// Open a modal with the entrance animation (adds .modal-enter to the .modal-content)
function openModal(modal) {
    if (!modal) return;
    // display as flex to center (CSS uses flexbox)
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    // trigger reflow then add class to animate
    content.classList.remove('modal-enter');
    // allow the browser a tick
    requestAnimationFrame(() => {
        content.classList.add('modal-enter');
    });
    // remove the class after animation ends so repeated opens animate
    const onEnd = () => {
        content.classList.remove('modal-enter');
        content.removeEventListener('animationend', onEnd);
    };
    content.addEventListener('animationend', onEnd);
}

// Allow clicking the metric cards to filter the orders table by status
function setupMetricFilters() {
    const metrics = document.querySelectorAll('.orders-metrics .metric');
    if (!metrics || metrics.length === 0) return;
    metrics.forEach(m => {
        m.addEventListener('click', () => {
            const status = m.getAttribute('data-status') || 'all';
            // toggle active
            const currentlyActive = m.classList.contains('active');
            document.querySelectorAll('.orders-metrics .metric').forEach(x => x.classList.remove('active'));
            const targetStatus = currentlyActive ? 'all' : status;
            if (!currentlyActive) m.classList.add('active');
            loadOrdersTable(targetStatus);
        });
    });
}

