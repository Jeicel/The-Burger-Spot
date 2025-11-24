# The Burger SPOT — README

This repository is a static HTML/CSS/JS demo of a small ordering site. The following notes explain how demo accounts work on deployment (for example, when deploying to Vercel), how to seed or remove them, and important security reminders.

## Demo accounts (for staging/test only)
The project includes optional demo accounts which are loaded from `data/users.json` if that file exists on the deployed site. The demo credentials (for convenience) are:

- customer@theburger.com / demo123  (role: customer)
- staff@theburger.com    / demo123  (role: staff)
- admin@theburger.com    / demo123  (role: admin)

These accounts are present so a freshly deployed site can be tested immediately. If you want the demo accounts available on Vercel, keep `data/users.json` in the repo. If you prefer NOT to include demo accounts in production, remove `data/users.json` before deploying or replace it with an empty array `[]`.

## How the site loads users on startup
- On page load the app attempts to fetch `data/users.json` and merges any users into the in-memory `database.users` list.
- Email comparisons during login/registration are normalized (trimmed and lowercased) so casing and stray spaces don't break authentication.
- To prevent old demo users from lingering in visitors' browsers, the app will purge known demo/demo-domain email addresses from `localStorage` on startup.

## Clearing local test accounts locally (browser)
If you or a tester still sees demo accounts locally, clear the saved users/currentUser from localStorage:

Open DevTools → Console and run:

```javascript
localStorage.removeItem('users');
localStorage.removeItem('currentUser');
# The Burger SPOT — README

This repository is a static HTML/CSS/JS demo of a small ordering site. The following notes explain how demo accounts work on deployment (for example, when deploying to Vercel), how to seed or remove them, and important security reminders.

## Demo accounts (for staging/test only)
The project includes optional demo accounts which are loaded from `data/users.json` if that file exists on the deployed site. The demo credentials (for convenience) are:

- customer@theburger.com / demo123  (role: customer)
- staff@theburger.com    / demo123  (role: staff)
- admin@theburger.com    / demo123  (role: admin)

These accounts are present so a freshly deployed site can be tested immediately. If you want the demo accounts available on Vercel, keep `data/users.json` in the repo. If you prefer NOT to include demo accounts in production, remove `data/users.json` before deploying or replace it with an empty array `[]`.

## How the site loads users on startup
- On page load the app attempts to fetch `data/users.json` and merges any users into the in-memory `database.users` list.
- Email comparisons during login/registration are normalized (trimmed and lowercased) so casing and stray spaces don't break authentication.
- To prevent old demo users from lingering in visitors' browsers, the app will purge known demo/demo-domain email addresses from `localStorage` on startup.

## Clearing local test accounts locally (browser)
If you or a tester still sees demo accounts locally, clear the saved users/currentUser from localStorage:

Open DevTools → Console and run:

```javascript
localStorage.removeItem('users');
localStorage.removeItem('currentUser');
location.reload();
```

This clears persisted demo accounts for the current browser on that domain.

## Recommendations before production
- Remove `data/users.json` or replace it with an empty array to avoid shipping demo credentials.
- Rotate or remove default demo passwords (they are `demo123` in this project).
- Implement server-side authentication and secure password storage (hashed) if you plan to accept real orders and real customer data.
- Consider gating any account seeding behind build-time flags or environment variables so only staging builds include test accounts.

## Quick verification after deployment
1. Deploy to Vercel.
2. Visit the Login page and sign in (if demo accounts are present) with `admin@theburger.com` / `demo123`.
3. If admin features don't appear, check DevTools → Application → Local Storage and verify `users` and `currentUser` contents.

## Contact / Notes
This README is intentionally short. If you'd like, I can add a short staging/production checklist or provide a script to toggle seeding on/off during CI/deploy.

-- End of README --

