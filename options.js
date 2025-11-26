const COUNTRIES = [
  // Regions
  "Africa", "Antarctica",
  "Eastern Europe (Non-EU)", "Europe",
  "Middle East",
  "Southeast Asia", "South America",
  "North America",
  "West Asia",

  // Countries
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestinian Territories", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

// Elements
const listEl = document.getElementById('countryList');
const searchBox = document.getElementById('searchBox');
const btnSelectAll = document.getElementById('btnSelectAll');
const btnDeselectAll = document.getElementById('btnDeselectAll');

const whitelistEl = document.getElementById('whitelistInput');
const safeFollowsEl = document.getElementById('safeFollows');
const showPlaceholderEl = document.getElementById('showPlaceholder');
const showBadgeEl = document.getElementById('showBadge');
const autoBlockEl = document.getElementById('autoBlock');
const autoMuteEl = document.getElementById('autoMute');

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const fileInput = document.getElementById('fileInput');
const statusMsg = document.getElementById('importStatus');

const lockAlert = document.getElementById('systemLockAlert');
const lockTimerSpan = document.getElementById('lockTimer');
let lockInterval = null;

// Selections
let currentlySelected = new Set();

// Rendering list with filtering options
function renderList(filterText = "") {
  listEl.innerHTML = "";
  COUNTRIES.sort();

  const filterLower = filterText.toLowerCase();

  COUNTRIES.forEach(c => {
    // Search filter
    if (!c.toLowerCase().includes(filterLower)) return;

    const id = "c_" + c.replace(/[^a-z0-9]/ig, "_");
    const label = document.createElement("label");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = id;
    chk.value = c;

    if (currentlySelected.has(c)) chk.checked = true;

    // Update set on any change
    chk.addEventListener('change', (e) => {
        if (e.target.checked) currentlySelected.add(c);
        else currentlySelected.delete(c);
    });

    label.appendChild(chk);
    label.appendChild(document.createTextNode(c));
    listEl.appendChild(label);
  });
}

// Searching
searchBox.addEventListener('input', (e) => {
    renderList(e.target.value);
});

// Checkboxes
btnSelectAll.addEventListener('click', () => {
    const visibleCheckboxes = listEl.querySelectorAll('input[type="checkbox"]');
    visibleCheckboxes.forEach(chk => {
        chk.checked = true;
        currentlySelected.add(chk.value);
    });
});

btnDeselectAll.addEventListener('click', () => {
    const visibleCheckboxes = listEl.querySelectorAll('input[type="checkbox"]');
    visibleCheckboxes.forEach(chk => {
        chk.checked = false;
        currentlySelected.delete(chk.value);
    });
});

// Load Settings
function loadSettings() {
  chrome.storage.local.get(["blockedCountries", "whitelist", "safeFollows", "showPlaceholder", "showBadge", "autoBlock", "autoMute"], d => {
    // Fill the set
    currentlySelected = new Set(d.blockedCountries || []);
    renderList(""); // First render with no filter on

    whitelistEl.value = (d.whitelist || []).join(", ");
    safeFollowsEl.checked = d.safeFollows || false;
    showPlaceholderEl.checked = (d.showPlaceholder !== false);
    showBadgeEl.checked = (d.showBadge !== false);
    autoBlockEl.checked = d.autoBlock || false;
    autoMuteEl.checked = d.autoMute || false;
  });
}

// Statistics
function loadStats() {
    chrome.storage.local.get(["filterStats"], (res) => {
        const stats = res.filterStats || { total: 0, byCountry: {} };
        document.getElementById('totalBlocked').innerText = stats.total;
        let topC = "-";
        let maxCount = 0;
        for (const [country, count] of Object.entries(stats.byCountry)) {
            if (count > maxCount) { maxCount = count; topC = country; }
        }
        if(maxCount > 0) document.getElementById('topCountry').innerText = `${topC} (${maxCount})`;
    });
}

function checkLockStatus() {
    chrome.storage.local.get(["systemLockStatus"], (res) => {
        const status = res.systemLockStatus;

        if (status && status.isLocked && status.lockUntil > Date.now()) {
            lockAlert.style.display = "block";

            // Start countdown timer
            if (lockInterval) clearInterval(lockInterval);
            updateTimerDisplay(status.lockUntil);
            lockInterval = setInterval(() => updateTimerDisplay(status.lockUntil), 1000);
        } else {
            lockAlert.style.display = "none";
            if (lockInterval) clearInterval(lockInterval);
        }
    });
}

function updateTimerDisplay(endTime) {
    const diff = endTime - Date.now();
    if (diff <= 0) {
        checkLockStatus();
        return;
    }

    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    lockTimerSpan.innerText = `${minutes} minutes ${seconds} seconds`;
}

// Toggle logic for block/mute options
autoBlockEl.addEventListener('change', () => { if (autoBlockEl.checked) autoMuteEl.checked = false; });
autoMuteEl.addEventListener('change', () => { if (autoMuteEl.checked) autoBlockEl.checked = false; });

// Save Settings
document.getElementById("saveBtn").addEventListener("click", () => {
  // Convert set to array and save
  const blockedArray = Array.from(currentlySelected);

  const whitelistRaw = whitelistEl.value.split(",");
  const whitelist = whitelistRaw.map(s => s.trim().replace('@','')).filter(s => s.length > 0);

  const settings = {
      blockedCountries: blockedArray,
      whitelist: whitelist,
      safeFollows: safeFollowsEl.checked,
      showPlaceholder: showPlaceholderEl.checked,
      showBadge: showBadgeEl.checked,
      autoBlock: autoBlockEl.checked,
      autoMute: autoMuteEl.checked
  };

  chrome.storage.local.set(settings, () => {
    const btn = document.getElementById("saveBtn");
    const originalText = btn.innerText;
    btn.innerText = "Saved Successfully!";
    setTimeout(() => { btn.innerText = originalText; }, 1500);
  });
});

// Clear Cache
document.getElementById("clearCache").addEventListener("click", () => {
  chrome.storage.local.remove(["userSystemLocationCache_SafeV2"], () => {
    alert("Cache Has Been Cleared.");
  });
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.systemLockStatus) {
        checkLockStatus();
    }
});

exportBtn.addEventListener('click', () => {
    const keys = ["blockedCountries", "whitelist", "safeFollows", "showPlaceholder", "showBadge", "autoBlock", "autoMute"];
    chrome.storage.local.get(keys, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `x-filter-settings-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const d = JSON.parse(event.target.result);
            if (!d || typeof d !== 'object') throw new Error("Geçersiz dosya.");

            const s = {};
            if (d.blockedCountries) s.blockedCountries = d.blockedCountries;
            if (d.whitelist) s.whitelist = d.whitelist;
            if (typeof d.safeFollows === "boolean") s.safeFollows = d.safeFollows;
            if (typeof d.showPlaceholder === "boolean") s.showPlaceholder = d.showPlaceholder;
            if (typeof d.showBadge === "boolean") s.showBadge = d.showBadge;
            if (typeof d.autoBlock === "boolean") s.autoBlock = d.autoBlock;
            if (typeof d.autoMute === "boolean") s.autoMute = d.autoMute;

            chrome.storage.local.set(s, () => {
                loadSettings();
                statusMsg.style.display = "block";
                statusMsg.style.color = "#17bf63";
                statusMsg.innerText = "Loaded!";
                setTimeout(() => statusMsg.style.display = "none", 3000);
            });
        } catch (err) { alert("Error: " + err.message); }
    };
    reader.readAsText(file);
    fileInput.value = '';
});

checkLockStatus();
loadSettings();
loadStats();
setInterval(loadStats, 5000);