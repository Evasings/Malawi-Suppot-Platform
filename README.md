[README.md](https://github.com/user-attachments/files/23211727/README.md)
# Malawi Support Platform — MVP (Express + static frontend)

This is a minimal, working MVP to test the donation flow, internal wallets, platform commission, support pool, and campaign resolution logic.

## What is included
- Backend: Node.js (Express) with SQLite (better-sqlite3)
- Simple simulated Airtel integration (`airtel.js`) – replace with real merchant calls when ready
- Static frontend (public/index.html) that you can open in Firefox/Mozilla while backend runs

## Quick local run (Linux / macOS / Windows with Node.js installed)
1. Open a terminal.
2. `cd backend`
3. `npm install`
4. `node index.js`
5. Open your browser (Firefox/Mozilla recommended) at `http://localhost:3000`

## How to test (example flow)
1. Create a user (type `creator` or `team`). Note the returned `"id"`.
2. Create a campaign with that owner ID.
3. Use Donate to send amounts to the campaign.
4. If campaign closes under target, use Resolve to top up from `support-pool-wallet` (if funds exist).
5. Query wallets: platform-wallet, support-pool-wallet, or `w-<ownerId>` for creator/team balance.

## Production notes & next steps
- Replace `airtel.js` with real Airtel/TNM merchant API integration and secure webhooks.
- Add authentication (JWT or sessions) and admin verification for teams.
- Use PostgreSQL or another RDBMS for scaling.
- Add HTTPS, rate limiting, input validation, and CSRF protection.
- Consider hosting: Render, Railway, Heroku (legacy), or a VPS. Configure environment variables for commission percent.

## Files
- backend/index.js
- backend/db.js
- backend/airtel.js
- backend/package.json
- public/index.html

