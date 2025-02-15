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

class TabManager {
    constructor(webSocketManager) {
        this.tabHistory = {}; // Stores the last accessed time of tabs
        this.webSocketManager = webSocketManager;
        this.listenToTabEvents();
    }

    listenToTabEvents() {
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.updateTabHistory(activeInfo.tabId);
            this.sendTabsToVSCode();
        });

        chrome.tabs.onUpdated.addListener(() => this.sendTabsToVSCode());
        chrome.tabs.onRemoved.addListener((tabId) => {
            delete this.tabHistory[tabId];
            this.sendTabsToVSCode();
        });

        chrome.tabs.onCreated.addListener(() => this.sendTabsToVSCode());
    }

    updateTabHistory(tabId) {
        this.tabHistory[tabId] = { lastAccessed: Date.now() };
    }

    async sendTabsToVSCode() {
        const tabs = await chrome.tabs.query({});
        console.log(tabs);

        // Update timestamps for new tabs
        tabs.forEach(tab => {
            if (!this.tabHistory[tab.id]) {
                this.updateTabHistory(tab.id);
            }
        });

        // Sort tabs by last accessed time
        tabs.sort((a, b) => (this.tabHistory[b.id]?.lastAccessed || 0) - (this.tabHistory[a.id]?.lastAccessed || 0));

        const tabInfo = tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            icon: tab.favIconUrl,
            lastAccessed: this.tabHistory[tab.id]?.lastAccessed || 0
        }));

        this.webSocketManager.send({ tabs: tabInfo });
    }

    activateTab(tabId) {
        chrome.tabs.get(tabId, (tab) => {
            if (tab) {
                chrome.tabs.update(tab.id, { active: true });
                this.updateTabHistory(tab.id);
                this.sendTabsToVSCode();
            }
        });
    }
}

// Initialization
const webSocketManager = new WebSocketManager();
const tabManager = new TabManager(webSocketManager);
webSocketManager.setTabManager(tabManager);