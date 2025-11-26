# Tweet-Filter-by-Country
Advanced Timeline Sanitization and Geo-Blocking Utility for X (Twitter).

## About
X Country Filter is a sophisticated browser extension engineered to curate the X timeline by filtering content based on the verified origin location of user accounts. Unlike rudimentary keyword blockers that rely on user-generated bio text, this tool leverages X's internal GraphQL APIs to ascertain the system-registered location of an account, providing highly accurate filtering capabilities.<br>
Designed with performance and account safety as primary objectives, it implements intelligent **request throttling**, **LIFO queue architecture**, and **persistent local caching** to ensure a seamless and secure user experience.

## Core Features
### 1. Precision Geo-Blocking
The extension intercepts the timeline DOM stream and verifies the origin country or region of content creators against a user-defined blocklist. It distinguishes between user-declared locations and system-verified locations (e.g. App Store region, IP-based inference) for maximum accuracy.

### 2. Automated Moderation Actions
Beyond visual filtering, the system offers optional automated moderation capabilities:<br>
- **Auto-Mute:** Automatically mutes users from restricted regions without interrupting the browsing flow.<br>
- **Auto-Block:** Instantly blocks users from restricted regions, removing them from the user's digital environment permanently.

### 3. Heuristic Anti-Ban Protection (Smart Throttling)
To navigate X's strict API rate limits and bot detection systems, the extension employs a **Human Behavior Simulation algorithm**:<br>
**Randomized Latency:** API requests are spaced with randomized intervals (3000ms - 4500ms) to mimic natural human interaction patterns.<br>
**Circuit Breaker Mechanism:** In the event of a 429 (Too Many Requests) response, the system automatically engages a **"System Lock"** mode, pausing all background operations for a set duration to protect the user's account standing.

### 4. High-Performance LIFO Architecture
Recognizing the dynamic nature of infinite scrolling, the extension utilizes a Last-In, First-Out (LIFO) queueing system.<br>
**Viewport Prioritization:** The system prioritizes processing tweets currently visible in the user's viewport. If a user scrolls rapidly, pending requests for off-screen tweets are discarded or deprioritized in favor of the active content.<br>
**Smart Distance Calculation:** The content script calculates the distance of tweet elements relative to the viewport center, ensuring the most relevant content is processed first.

### 5. Persistent Local Database
**Zero-Latency Filtering:** Once a user account is analyzed, the data is stored in the browser's chrome.storage.local. Subsequent encounters with the same user are processed instantly (0ms latency) without triggering new API calls.<br>
**Efficiency:** This caching mechanism significantly reduces API load over time, making the extension faster the more it is used.

# Installation
This extension is built for **Chromium-based** browsers (Chrome, Edge, Opera, Brave):<br>
**1.** Clone or download this repository.<br>
**2.** Navigate to your browser's Extensions management page (e.g. chrome://extensions, opera://extensions).<br>
**3.** Enable Developer Mode (usually a toggle switch in the top right corner).<br>
**4.** Click Load unpacked.<br>
**5.** Select the directory containing the extension files.

# Configuration
Upon installation, access the **Options page** to configure the system:<br>
**Blocked Regions:** Select specific countries or regions to filter from the comprehensive list provided.<br>
**Whitelist:** Define specific usernames to exclude from filtering logic, regardless of their location.<br>
**Action Settings:** Toggle between simple hiding, visual placeholders, Auto-Mute or Auto-Block modes.<br>
**Safe Follows:** Enable protection for accounts you already follow to prevent accidental filtering.<br>
**Backup & Restore:** Export your configuration settings to a JSON file for backup or migration purposes.

# Technical Architecture (For The Curious)
The project consists of three main components interacting asynchronously:<br>
**Content Script:** Monitors the DOM for new tweet elements (MutationObserver), calculates element visibility (IntersectionObserver), and manages the UI layer (placeholders, badges). It handles the client-side priority queue logic.<br>
**Background Service Worker:** Acts as the central processing unit. It manages the API request queue, handles token retrieval (ct0, auth_token), executes GraphQL queries, and maintains the local database. It strictly adheres to the "Circuit Breaker" protocols.<br>
**Options Interface:** A standalone page for user configuration, utilizing Chrome Storage API for state management and providing real-time statistics on blocked content.

# Privacy & Security
**Client-Side Execution:** All data processing occurs locally within the user's browser.<br>
**No External Telemetry:** The extension does not communicate with any third-party servers. No user data, browsing history, or credentials are collected or transmitted.<br>
**Token Usage:** Authentication tokens are retrieved dynamically from the active session solely for the purpose of making authorized requests to X's internal endpoints on the user's behalf.<br>

# Disclaimer
This project is an independent open-source initiative and is not affiliated with, endorsed by or connected to X Corp. The functionality relies on internal APIs which are subject to change. **Use this tool responsibly and at your own risk**.

# License & Contribution
This project is licensed under Apache 2.0 License.<br>
You can contribute the project or give feedback to solve problems via here or support page in the extension.
