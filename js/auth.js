// Authentication functions
function login(email, password) {
    const normalized = (email || '').trim().toLowerCase();
    const user = database.users.find(u => ((u.email || '').trim().toLowerCase() === normalized) && u.password === password);
    
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateUIForUser();
        showNotification(`Welcome back, ${user.name}!`);
        
        // Redirect based on previous page or to home
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || 'index.html';
        window.location.href = redirect;
        return true;
    } else {
        showNotification('Invalid email or password', 'error');
        return false;
    }
}

const _hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
const _isLocalHost = _hostname === 'localhost' || _hostname === '127.0.0.1';

function getApiUrl(path) {
    const base = ((window && window.API_BASE_URL) || '').replace(/\/$/, '');
    if (base) return `${base}${path}`;
    return `${window.location.origin}${path}`;
}

async function register(name, email, password, confirmPassword) {
    // Validation
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return false;
    }
    const normalized = (email || '').trim().toLowerCase();
   if (database.users.find(u => ((u.email || '').trim().toLowerCase() === normalized))) {
        showNotification('Email already registered', 'error');
        return false;
    }

    // If API base isn't configured and we're not running locally, surface a clearer error.
    const currentBase = ((window && window.API_BASE_URL) || '').replace(/\/$/, '');
    if (!currentBase && !_isLocalHost) {
        const attempted = `${window.location.origin}/api/users`;
        console.error('API_BASE_URL is not configured. Attempted request would be:', attempted);
        showNotification('Server API not configured for this deployment. Set `API_BASE_URL` in Netlify (or use the in-page "Set for session" tool).', 'error');
        return false;
    }

    try {
        const url = getApiUrl('/api/users');
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email: normalized, password })
            });
        } catch (networkErr) {
            console.error('Network error while POSTing to', url, networkErr);
            showNotification(`Network error: could not reach API at ${url}. Check server or API_BASE configuration.`, 'error');
            return false;
        }

        let data = null;
        // Try JSON parse first, fall back to text for debugging messages
        try { data = await res.json(); } catch (e) {
            try { data = await res.text(); } catch (e2) { data = null; }
        }

        if (!res.ok) {
            const serverMsg = data && (data.error || data.message) ? (data.error || data.message) : res.statusText;
            console.error('Registration failed', { status: res.status, body: data });
            showNotification(`Registration failed (${res.status}): ${serverMsg}`, 'error');
            return false;
        }

        const user = data.user;
        // store minimal user data locally (no password)
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateUIForUser();
        showNotification(`Account created successfully! Welcome, ${user.name || ''}!`);
        window.location.href = 'index.html';
        return true;
    } catch (err) {
        console.error('Unexpected error in register()', err);
        showNotification('Registration failed (unexpected error). See console for details.', 'error');
        return false;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUIForUser();
    showNotification('You have been logged out');
    window.location.href = 'index.html';
}

// Setup login form
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        console.log('setupLoginForm: loginForm found, attaching submit handler');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            login(email, password);
        });
    }
}

// Setup register form
function setupRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            register(name, email, password, confirmPassword);
        });
    }
}

// Setup auth tabs
function setupAuthTabs() {
    const authTabs = document.querySelectorAll('.auth-tab');
    if (authTabs.length > 0) {
        authTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                
                // Update active tab
                authTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show corresponding content
                const authContents = document.querySelectorAll('.auth-content');
                authContents.forEach(content => {
                    content.classList.add('hidden');
                    if (content.id === `${tabId}-content`) {
                        content.classList.remove('hidden');
                    }
                });
            });
        });
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
    setupLogoutButton();
});