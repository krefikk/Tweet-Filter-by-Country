// Dont get excited, these are not private keys
const QID_ABOUT = "XRqGa7EeokUU5kppkh13EA";
const QID_USER = "sLVLhk0bGj3GYdNimUOP4g";
const QID_PSPOTLIGHTS = "mzoqrVGwk-YTSGME1dRfXQ";
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const CACHE_KEY = 'userSystemLocationCache__';

// General Variables
let isSystemLocked = false;
let lockUntil = 0;
const requestQueue = [];
let isProcessingQueue = false;

// Helper Functions
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getCache() {
    const d = await chrome.storage.local.get([CACHE_KEY]);
    return d[CACHE_KEY] || {};
}

async function setCache(data) {
    await chrome.storage.local.set({ [CACHE_KEY]: data });
}

async function getCsrfToken() {
    const cookie = await chrome.cookies.get({ url: "https://x.com", name: "ct0" });
    return cookie ? cookie.value : null;
}

function updateLockStatus(locked, until = 0) {
    chrome.storage.local.set({
        systemLockStatus: {
            isLocked: locked,
            lockUntil: until
        }
    });
}

// Queue Operations
async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (requestQueue.length > 0) {
        // Check for cache if user is already checked before
        const currentReq = requestQueue[0];
        const cache = await getCache();
        if (cache[currentReq.username] && (Date.now() - cache[currentReq.username].ts < 86400000)) {
            requestQueue.shift();
            currentReq.sendResponse({ country: cache[currentReq.username].country, fromCache: true });
            continue;
        }

        // If the program hits the rate limit, lock the program for a while to prevent the user from being harmed
        if (isSystemLocked) {
            const timeLeft = lockUntil - Date.now();
            if (timeLeft > 0) {
                console.warn(`System Locked: Waiting for ${Math.ceil(timeLeft/1000)} seconds.`);
                updateLockStatus(true, lockUntil);
                await sleep(5000);
                continue;
            } else {
                console.log("System Unlocked!");
                isSystemLocked = false;
                updateLockStatus(false);
            }
        }

        // Wait 3.5-5 seconds before sending a request to avoid hitting the rate limit.
        const delay = Math.floor(Math.random() * 1500) + 3500;
        await sleep(delay);

        if (requestQueue.length === 0) break;

        // Get first request from queue
        const { username, sendResponse } = requestQueue.shift();

        try {
            const result = await fetchUser(username);

            // If hit with rate limit, lock the system for 15 minutes
            if (result.error === "RATE_LIMIT") {
                isSystemLocked = true;
                lockUntil = Date.now() + (15 * 60 * 1000);
                console.error("RATE LIMIT! Timeout for 15 minutes.");
                updateLockStatus(true, lockUntil);
                continue;
            }

            sendResponse(result);
        } catch (err) {
            console.error("Queue Error:", err);
            sendResponse({ country: null, error: err.toString() });
        }
    }
    isProcessingQueue = false;
}

// Send request to API to fetch the location and following status of user
async function fetchUser(username) {
    const cache = await getCache();

    if (cache[username] && (Date.now() - cache[username].ts < 86400000)) {
        return {
            country: cache[username].country,
            isFollowing: cache[username].isFollowing,
            fromCache: true
        };
    }

    const csrfToken = await getCsrfToken();
    if (!csrfToken) return { country: null, error: "No Token" };

    const variables = JSON.stringify({ "screenName": username });
    const features = JSON.stringify({
        "hidden_profile_likes_enabled": true,
        "hidden_profile_subscriptions_enabled": true,
        "verified_phone_label_enabled": true,
        "subscriptions_verification_info_is_identity_verified_enabled": true,
        "subscriptions_verification_info_verified_since_enabled": true,
        "highlights_tweets_tab_ui_enabled": true,
        "creator_subscriptions_tweet_preview_api_enabled": true,
        "responsive_web_graphql_exclude_directive_enabled": true,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
        "responsive_web_graphql_timeline_navigation_enabled": true
    });
    const urlAbout = `https://x.com/i/api/graphql/${QID_ABOUT}/AboutAccountQuery?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

    const varsPS = JSON.stringify({ "screen_name": username });
    const urlPS = `https://x.com/i/api/graphql/${QID_PSPOTLIGHTS}/ProfileSpotlightsQuery?variables=${encodeURIComponent(varsPS)}`;

    try {
        const [respAbout, respPS] = await Promise.all([
            fetch(urlAbout, {
                method: 'GET',
                headers: { 'authorization': `Bearer ${BEARER_TOKEN}`, 'x-csrf-token': csrfToken, 'content-type': 'application/json' }
            }),
            fetch(urlPS, {
                method: 'GET',
                headers: { 'authorization': `Bearer ${BEARER_TOKEN}`, 'x-csrf-token': csrfToken, 'content-type': 'application/json' }
            })
        ]);

        if (respAbout.status === 429 || respPS.status === 429) {
            return { country: null, error: "RATE_LIMIT" };
        }

        // Read JSONs
        const jsonAbout = respAbout.ok ? await respAbout.json() : {};
        const jsonPS = respPS.ok ? await respPS.json() : {};

        const result = jsonAbout?.data?.user_result_by_screen_name?.result;
        const country = result?.about_profile?.account_based_in;

        const resultPS = jsonPS?.data?.user_result_by_screen_name?.result;
        const isFollowing = !!resultPS?.relationship_perspectives?.following === true;

        if (isFollowing == undefined) {
            isFollowing = true;
        }

        console.log(`[DualAPI] ${username} -> ${country || "NONE"} | Following: ${isFollowing}`);

        cache[username] = {
            country: country,
            isFollowing: isFollowing,
            ts: Date.now()
        };
        await setCache(cache);

        return { country: country, isFollowing: isFollowing, fromCache: false };

    } catch (err) {
        return { country: null, isFollowing: false, error: err.toString() };
    }
}

// To block users automatically
async function blockUser(username) {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) return { success: false, error: "No login!" };

    const url = "https://x.com/i/api/1.1/blocks/create.json";
    const formData = new URLSearchParams();
    formData.append("screen_name", username);
    formData.append("skip_status", "1");

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${BEARER_TOKEN}`,
                'x-csrf-token': csrfToken,
                'content-type': 'application/x-www-form-urlencoded',
                'x-twitter-active-user': 'yes'
            },
            body: formData
        });

        if (!resp.ok) return { success: false, error: resp.statusText };
        console.log(`@${username} has been blocked!`);
        return { success: true };

    } catch (err) {
        return { success: false, error: err.toString() };
    }
}

// To unblock automatically blocked users
async function unblockUser(username) {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) return { success: false, error: "No login!" };

    const url = "https://x.com/i/api/1.1/blocks/destroy.json";
    const formData = new URLSearchParams();
    formData.append("screen_name", username);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${BEARER_TOKEN}`,
                'x-csrf-token': csrfToken,
                'content-type': 'application/x-www-form-urlencoded',
                'x-twitter-active-user': 'yes'
            },
            body: formData
        });

        if (!resp.ok) return { success: false, error: resp.statusText };
        console.log(`@${username}'s block has been removed.`);
        return { success: true };

    } catch (err) {
        return { success: false, error: err.toString() };
    }
}

// To mute users automatically
async function muteUser(username) {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) return { success: false, error: "No login!" };

    const url = "https://x.com/i/api/1.1/mutes/users/create.json";
    const formData = new URLSearchParams();
    formData.append("screen_name", username);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${BEARER_TOKEN}`,
                'x-csrf-token': csrfToken,
                'content-type': 'application/x-www-form-urlencoded',
                'x-twitter-active-user': 'yes'
            },
            body: formData
        });
        if (!resp.ok) return { success: false, error: resp.statusText };
        console.log(`@${username} has been muted!`);
        return { success: true };
    } catch (err) { return { success: false, error: err.toString() }; }
}

// To unblock automatically blocked users
async function unmuteUser(username) {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) return { success: false, error: "Oturum yok" };

    const url = "https://x.com/i/api/1.1/mutes/users/destroy.json";
    const formData = new URLSearchParams();
    formData.append("screen_name", username);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${BEARER_TOKEN}`,
                'x-csrf-token': csrfToken,
                'content-type': 'application/x-www-form-urlencoded',
                'x-twitter-active-user': 'yes'
            },
            body: formData
        });
        if (!resp.ok) return { success: false, error: resp.statusText };
        console.log(`@${username}'s mute has been removed.`);
        return { success: true };
    } catch (err) { return { success: false, error: err.toString() }; }
}

// Listeners
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // Region/Country Query
    if (msg.type === 'fetchCountryForUser') {
        requestQueue.push({ username: msg.username, sendResponse });
        processQueue();
        return true; 
    }

    // Blocking
    if (msg.type === 'blockUser') {
        blockUser(msg.username).then(sendResponse);
        return true;
    }

    // Unblocking
    if (msg.type === 'unblockUser') {
        unblockUser(msg.username).then(sendResponse);
        return true;
    }

    // Muting
    if (msg.type === 'muteUser') {
        muteUser(msg.username).then(sendResponse);
        return true;
    }

    // Unmuting
    if (msg.type === 'unmuteUser') {
        unmuteUser(msg.username).then(sendResponse);
        return true;
    }

    // Badge
    if (msg.type === 'updateBadge' && sender.tab) {
        const text = (msg.count && msg.count > 0) ? msg.count.toString() : "";
        try {
            chrome.action.setBadgeText({ text: text, tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: "#E0245E", tabId: sender.tab.id });
        } catch (e) {}
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
        requestQueue.length = 0; // Cleanup on update
    }
});
