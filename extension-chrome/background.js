class WebSocketManager {
    constructor() {
        this.ws = null;
        this.WS_URL = "ws://localhost:5000";
        this.RECONNECT_INTERVAL = 5000;
        this.connect();
    }

    setTabManager(tabManager) {
        this.tabManager = tabManager;
    }

    /**
     * Initializes and manages the WebSocket connection.
     * Sets up event handlers for messages, errors, and reconnections.
     */
    connect() {
        console.log("🔄 Attempting to connect to WebSocket...");

        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
            console.log("✅ WebSocket connection established!");
            if (this.tabManager) {
                this.tabManager.sendTabsToVSCode();
            }
        };

        this.ws.onmessage = (message) => {
            try {
                const data = JSON.parse(message.data);

                if (data.action === "activateTab") {
                    this.tabManager.activateTab(data.id);
                    console.log("📥 Activating tab:", data.id);
                }

                if (data.action === "search") {
                    chrome.tabs.create({
                        url: data.url
                    });
                }
            } catch (error) {
                console.error("❌ Error receiving message:", error);
            }
        };

        this.ws.onerror = (error) => {
            console.error("❌ WebSocket error:", error);
            this.reconnect();
        };

        this.ws.onclose = () => {
            console.warn("⚠️ WebSocket connection closed, attempting to reconnect...");
            this.reconnect();
        };
    }

    reconnect() {
        setTimeout(() => {
            console.log("🔄 Reconnecting to WebSocket...");
            this.connect();
        }, this.RECONNECT_INTERVAL);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            console.log("📤 Data sent:", data);
        } else {
            console.warn("⚠️ WebSocket not connected. Will retry sending later...");
        }
    }
}


/**
 * Manage access history and tab usage frequency
 * in the Chrome browser. Interacts with a WebSocket to send
 * data to a VSCode extension.
 */
class TabManager {
    constructor(webSocketManager) {
        this.tabHistory = {};  // Stores tab metadata (last accessed time and usage frequency)
        this.webSocketManager = webSocketManager;
        this.listenToTabEvents();
    }

    /**
     * Initializes event listeners for Chrome tabs.
     * This allows you to track tab activations, updates, deletions, 
     * and tab creations to keep local history up to date
     */
    listenToTabEvents() {
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.updateTabHistoryLastAccessed(activeInfo.tabId);
            this.updateFrequency(activeInfo.tabId);
            this.sendTabsToVSCode();
        });

        chrome.tabs.onUpdated.addListener((tabId) => {
            this.updateTabHistoryLastAccessed(tabId);
            this.sendTabsToVSCode();

            this.resetFrequency(tabId);
        });

        chrome.tabs.onRemoved.addListener((tabId) => {
            delete this.tabHistory[tabId];
            this.sendTabsToVSCode();
        });

        chrome.tabs.onCreated.addListener(() => {
            this.sendTabsToVSCode();
        });
    }

    /**
     * Updates the last accessed timestamp of a tab.
     * Initializes the entry if it doesn't exist.
     * @param {number} tabId - ID of the tab to update.
     */
    updateTabHistoryLastAccessed(tabId) {
        const now = Date.now();

        if (!this.tabHistory[tabId]) {
            this.tabHistory[tabId] = { lastAccessed: now };
        }
        this.tabHistory[tabId].lastAccessed = now;

    }

    /**
     * Increments the frequency count of a tab.
     * Initializes the frequency if it doesn't exist.
     * @param {number} tabId - ID of the tab.
     */
    updateFrequency(tabId) {
        if (!this.tabHistory[tabId]) {
            this.tabHistory[tabId] = { frequency: 0 };
        } else {
            this.tabHistory[tabId].frequency = this.tabHistory[tabId].frequency + 1 || 1;
        }


        console.log("History : ", this.tabHistory);
    }


    /**
     * Resets the frequency of a tab to 1.
     * Typically used when a tab is updated.
     * @param {number} tabId - ID of the tab.
     */
    resetFrequency(tabId) {
        if (this.tabHistory[tabId]) {
            this.tabHistory[tabId].frequency = 1;
        }
    }

    /**
     * Sends the current tab information to the VSCode extension via WebSocket.
     * It retrieves all tabs, updates their last accessed time and frequency, and sends the data.
     */
    async sendTabsToVSCode() {
        const tabs = await chrome.tabs.query({});
        console.log(tabs);

        // Update timestamps for new tabs
        tabs.forEach(tab => {
            if (!this.tabHistory[tab.id]) {
                this.updateTabHistoryLastAccessed(tab.id);
                this.updateFrequency(tab.id);
            }
        });


        const tabInfo = tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            icon: tab.favIconUrl,
            lastAccessed: this.tabHistory[tab.id].lastAccessed,
            frequency: this.tabHistory[tab.id].frequency
        }));

        this.webSocketManager.send({ tabs: tabInfo });
    }

    /**
     * Activates a tab by its ID and updates its metadata.
     * @param {number} tabId - The ID of the tab to activate.
     */
    activateTab(tabId) {
        chrome.tabs.get(tabId, (tab) => {
            if (tab) {
                chrome.tabs.update(tab.id, { active: true });
                this.updateTabHistoryLastAccessed(tab.id);
                this.updateFrequency(tab.id);
                this.sendTabsToVSCode();
            }
        });
    }
}

// Initialization
const webSocketManager = new WebSocketManager();
const tabManager = new TabManager(webSocketManager);
webSocketManager.setTabManager(tabManager);

// Keep the extension alive
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
        tabManager.sendTabsToVSCode();
    }
});
