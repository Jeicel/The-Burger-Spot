// Header component that can be included in all pages
function createHeader() {
    return `
        <div class="header-content">
            <div class="logo">
                <img src="images/logo.png" alt="The Burger  Logo" class="logo-image">
                <div class="logo-text">
                    <div class="logo-main">The Burger </div>
                    <div class="logo-subtitle">SPOT</div>
                    <div class="logo-tagline">Taste the Difference. Feel the flavor.</div>
                </div>
            </div>
            <nav>
                <ul>
                    <li><a href="index.html" class="nav-link">Home</a></li>
                    <li><a href="menu.html" class="nav-link">Menu</a></li>
                    <li><a href="cart.html" class="nav-link customer-only">Cart</a></li>
                    <li><a href="orders.html" class="nav-link customer-only">My Orders</a></li>
                    <li><a href="track-order.html" class="nav-link customer-only">Track Order</a></li>
                    <li><a href="admin.html" class="nav-link staff-admin-only">Admin</a></li>
                    <li class="user-info hidden" id="user-info">
                        <span id="user-name">User</span>
                        <span class="user-role" id="user-role">Customer</span>
                        <button class="logout-btn" id="logout-btn">Logout</button>
                    </li>
                    <li><a href="login.html" class="nav-link" id="login-link">Login</a></li>
                </ul>
            </nav>
        </div>
    `;
}

// Load header into the page
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('header');
    if (header) {
        header.innerHTML = createHeader();
        
        // Update active state for current page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const activeLink = header.querySelector(`a[href="${currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
});