let cachedCountries = [];
let whitelist = [];
let safeFollows = false;
let showPlaceholder = true;
let showBadge = true;
let autoBlock = false;
let autoMute = false;
let isExtensionContextAlive = true;

let blockedCountOnPage = 0;

const sessionBlockedUsers = new Set();
const autoBlockedSessionUsers = new Set();
const autoMutedSessionUsers = new Set();
const sessionAllowedUsers = new Set();

let pendingQueue = [];
let isProcessing = false;

// To refresh settings on change
function refreshSettings() {
    try {
        chrome.storage.local.get(["blockedCountries", "whitelist", "safeFollows", "showPlaceholder", "showBadge", "autoBlock", "autoMute"], (res) => {
            cachedCountries = res.blockedCountries || [];
            whitelist = (res.whitelist || []).map(u => u.toLowerCase());
            safeFollows = res.safeFollows || false;
            showPlaceholder = (res.showPlaceholder !== false);
            autoBlock = res.autoBlock || false;
            autoMute = res.autoMute || false;

            const newShowBadge = (res.showBadge !== false);
            if (showBadge !== newShowBadge) {
                showBadge = newShowBadge;
                updateBadge(showBadge ? blockedCountOnPage : 0);
            }
        });
    } catch (e) { isExtensionContextAlive = false; }
}
refreshSettings();
chrome.storage.onChanged.addListener(refreshSettings);

// Helper Functions
function updateBadge(count) {
    if (!showBadge && count > 0) return;
    try { if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'updateBadge', count: count }); } catch(e) {}
}

function updateStats(country) {
    try {
        chrome.storage.local.get(["filterStats"], (res) => {
            const stats = res.filterStats || { total: 0, byCountry: {} };
            stats.total += 1;
            stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
            chrome.storage.local.set({ filterStats: stats });
        });
    } catch(e) {}
}

function applyHideAction(tweet, username, country = "", isAutoBlockActive = false, isAutoMuteActive = false) {
    if (tweet.querySelector('.x-hidden-overlay') || tweet.style.display === 'none') return;

    if (isAutoBlockActive && !autoBlockedSessionUsers.has(username) && !sessionAllowedUsers.has(username)) {
        autoBlockedSessionUsers.add(username);
        try { chrome.runtime.sendMessage({ type: 'blockUser', username: username }); } catch(e) {}
    }
    else if (isAutoMuteActive && !autoMutedSessionUsers.has(username) && !sessionAllowedUsers.has(username)) {
        autoMutedSessionUsers.add(username);
        try { chrome.runtime.sendMessage({ type: 'muteUser', username: username }); } catch(e) {}
    }

    if (showPlaceholder) {
        const originalChildren = Array.from(tweet.children);
        originalChildren.forEach(c => c.style.display = 'none');

        const overlay = document.createElement('div');
        overlay.className = 'x-hidden-overlay';

        let borderColor = "#38444d";
        let infoText = `<b>@${username}</b> (${country}) has been hidden.`;
        let actionType = "none";

        if (isAutoBlockActive) {
            borderColor = "#e0245e";
            infoText = `<b>@${username}</b> (${country}) has been blocked.`;
            actionType = "block";
        } else if (isAutoMuteActive) {
            borderColor = "#ffad1f";
            infoText = `<b>@${username}</b> (${country}) has been muted.`;
            actionType = "mute";
        }

        overlay.style.cssText = `
            padding: 12px !important;
            background: rgba(21, 32, 43, 0.95) !important;
            border: 1px solid ${borderColor} !important;
            border-radius: 12px !important;
            margin: 10px 0 !important;
            text-align: center !important;
            color: #8899a6 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            font-size: 14px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            min-height: 60px !important;
            width: 100% !important;
            box-sizing: border-box !important;
        `;

        const textSpan = document.createElement('span');
        textSpan.innerHTML = infoText;
        textSpan.style.pointerEvents = "none";

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = "display: flex !important; gap: 15px !important; align-items: center !important;";

        const revealTweet = () => {
            overlay.remove();
            originalChildren.forEach(c => c.style.display = '');
            tweet.dataset.processed = "user_restored";
            sessionAllowedUsers.add(username);
            sessionBlockedUsers.delete(username);
        };

        const createShowBtn = () => {
            const btn = document.createElement('span');
            btn.innerText = "Show";
            btn.style.cssText = "color:#1da1f2 !important; font-weight:bold !important; cursor:pointer !important; padding: 4px 8px !important;";
            btn.onmouseover = () => btn.style.textDecoration = "underline";
            btn.onmouseout = () => btn.style.textDecoration = "none";
            btn.onclick = (e) => { e.stopPropagation(); revealTweet(); };
            return btn;
        };

        if (actionType === "block") {
            const actionBtn = document.createElement('span');
            actionBtn.innerText = "Unblock";
            actionBtn.style.cssText = "color:#e0245e !important; font-weight:bold !important; cursor:pointer !important; padding: 4px 8px !important; border: 1px solid #e0245e !important; border-radius: 20px !important;";
            
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                actionBtn.innerText = "Processing...";
                chrome.runtime.sendMessage({ type: 'unblockUser', username: username }, (res) => {
                    if (res && res.success) {
                        actionBtn.innerText = "Removed";
                        actionBtn.style.color = "#17bf63"; 
                        actionBtn.style.borderColor = "#17bf63";
                        actionBtn.onclick = null;
                        autoBlockedSessionUsers.delete(username);
                        setTimeout(() => {
                            actionBtn.remove();
                            btnGroup.appendChild(createShowBtn());
                            textSpan.innerHTML = `<b>@${username}</b> (${country}) has been hidden.`;
                            overlay.style.borderColor = "#38444d"; 
                        }, 1000);
                    } else { actionBtn.innerText = "Error!"; }
                });
            };
            btnGroup.appendChild(actionBtn);
        } else if (actionType === "mute") {
            const actionBtn = document.createElement('span');
            actionBtn.innerText = "Unmute";
            actionBtn.style.cssText = "color:#ffad1f !important; font-weight:bold !important; cursor:pointer !important; padding: 4px 8px !important; border: 1px solid #ffad1f !important; border-radius: 20px !important;";
            
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                actionBtn.innerText = "Processing...";
                chrome.runtime.sendMessage({ type: 'unmuteUser', username: username }, (res) => {
                    if (res && res.success) {
                        actionBtn.innerText = "Unmuted";
                        actionBtn.style.color = "#17bf63"; 
                        actionBtn.style.borderColor = "#17bf63";
                        actionBtn.onclick = null;
                        autoMutedSessionUsers.delete(username);
                        setTimeout(() => {
                            actionBtn.remove();
                            btnGroup.appendChild(createShowBtn());
                            textSpan.innerHTML = `<b>@${username}</b> (${country}) has been hidden.`;
                            overlay.style.borderColor = "#38444d"; 
                        }, 1000);
                    } else { actionBtn.innerText = "Hata!"; }
                });
            };
            btnGroup.appendChild(actionBtn);
        } else {
            btnGroup.appendChild(createShowBtn());
        }

        overlay.appendChild(textSpan);
        overlay.appendChild(btnGroup);
        tweet.appendChild(overlay);
    } else {
        tweet.style.setProperty("display", "none", "important");
        tweet.hidden = true;
        tweet.style.height = "0px";
    }
}

// Priority Logic
function calculatePriorities() {
    const viewportHeight = window.innerHeight;
    pendingQueue.forEach(item => {
        if (!document.body.contains(item.element)) { item.priority = 99999; return; }
        const rect = item.element.getBoundingClientRect();
        const isVisible = (rect.bottom > 0 && rect.top < viewportHeight);
        if (isVisible) item.priority = 0;
        else {
            const distTop = Math.abs(rect.bottom);
            const distBottom = Math.abs(rect.top - viewportHeight);
            item.priority = Math.min(distTop, distBottom);
        }
    });
    pendingQueue.sort((a, b) => a.priority - b.priority);
}

async function processNextInQueue() {
    if (isProcessing || pendingQueue.length === 0) return;
    calculatePriorities();
    isProcessing = true;
    
    const currentItem = pendingQueue.shift(); 
    const { element, username } = currentItem;

    if (!document.body.contains(element)) { isProcessing = false; processNextInQueue(); return; }
    if (sessionAllowedUsers.has(username)) { isProcessing = false; processNextInQueue(); return; }

    try {
        if (!chrome.runtime?.id) { isExtensionContextAlive = false; return; }

        chrome.runtime.sendMessage({ type: 'fetchCountryForUser', username: username }, (response) => {
            if (chrome.runtime.lastError) { isProcessing = false; setTimeout(processNextInQueue, 500); return; }

            if (response) {
                if (safeFollows && response.isFollowing === true) {
                    isProcessing = false;
                    processNextInQueue();
                    return;
                }

                // Location Check
                if (response.country) {
                    const userLocation = response.country;
                    const isBlocked = cachedCountries.some(blocked =>
                        userLocation.toLowerCase().includes(blocked.toLowerCase())
                    );

                    if (isBlocked) {
                        if (!sessionAllowedUsers.has(username)) {
                            sessionBlockedUsers.add(username);
                            blockedCountOnPage++;
                            updateBadge(blockedCountOnPage);
                            updateStats(userLocation);
                            applyHideAction(element, username, userLocation, autoBlock, autoMute);
                            console.log(`🗑️ @${username} (${userLocation})`);
                        }
                    }
                }
            }
            isProcessing = false;
            processNextInQueue();
        });
    } catch (err) { isProcessing = false; }
}

function runScanner() {
    if (!isExtensionContextAlive) return;
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-processed="true"])');
    let addedNew = false;

    tweets.forEach(tweet => {
        tweet.dataset.processed = "true";
        const userLink = tweet.querySelector('div[data-testid="User-Name"] a[href*="/"]');
        if (!userLink) return;
        const username = userLink.getAttribute('href').replace('/', '');

        if (whitelist.includes(username.toLowerCase()) || sessionAllowedUsers.has(username)) return;

        if (safeFollows) {
            const isFollowing = userLink.parentElement?.innerHTML.includes('aria-label="Following"') 
                             || tweet.innerHTML.includes('data-testid="userFollowIndicator"');
            if (isFollowing) return;
        }

        // Hiding
        if (sessionBlockedUsers.has(username)) {
            applyHideAction(tweet, username, "", autoBlock, autoMute);
            return;
        }

        pendingQueue.push({ element: tweet, username: username, priority: 0 });
        addedNew = true;
    });

    if (addedNew) processNextInQueue();
}

if (isExtensionContextAlive) {
    const observer = new MutationObserver(runScanner);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(runScanner, 1000);
}
