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

    updateTabHistoryLastAccessed(tabId) {
        const now = Date.now();

        if (!this.tabHistory[tabId]) {
            this.tabHistory[tabId] = { lastAccessed: now};
        }
        this.tabHistory[tabId].lastAccessed = now;

    }

    updateFrequency(tabId) {
        if(!this.tabHistory[tabId]) {
            this.tabHistory[tabId] = { frequency: 0 };
        } else {
            this.tabHistory[tabId].frequency = this.tabHistory[tabId].frequency + 1 || 1;
        }
        

        console.log("History : ", this.tabHistory);
    }

    
    resetFrequency(tabId) {
        if (this.tabHistory[tabId]) {
            this.tabHistory[tabId].frequency = 1;
        }
    }

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


        // // Calculate frequency of each tab
        // const sum_frequency = Object.values(this.tabHistory).reduce((acc, curr) => acc + (curr.frequency|| 0), 0);
        // console.log("Sum Frequency : ", sum_frequency);
        // const score_frequency = {};
        // tabs.forEach(tab => {
        //     if (this.tabHistory[tab.id]) {
        //         score_frequency[tab.id] = this.tabHistory[tab.id].frequency / sum_frequency || 0;
        //     }
        // }
        // );
    
        // console.log(score_frequency);

        // // calculate relevance of each tab
        // const score_relevance = {};
        // const lambda = 0.07;
        // tabs.forEach(tab => {
        //     if (this.tabHistory[tab.id]) {
        //         const elaspesedTime = (Date.now() - this.tabHistory[tab.id].lastAccessed) / 60000;
        //         console.log("Elapsed Time : ", elaspesedTime);
        //         score_relevance[tab.id] = Math.exp(-lambda * elaspesedTime) || 0;
        //     }
        // }
        // );
        // console.log("Relevance : ", score_relevance);

        // // calculate final score
        // const score = {};
        // const alpha = 0.3;
        // const beta = 0.7;
        // tabs.forEach(tab => {
        //     if (this.tabHistory[tab.id]) {
        //         score[tab.id] = score_frequency[tab.id] * alpha + score_relevance[tab.id] * beta;
        //     }
        // }
        // );

        // console.log("Score : ", score);



        // // Sort tabs by last accessed time
        // //tabs.sort((a, b) => (this.tabHistory[b.id]?.lastAccessed || 0) - (this.tabHistory[a.id]?.lastAccessed || 0));
        // tabs.sort((a, b) => score[b.id] - score[a.id]);

        const tabInfo = tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            icon: tab.favIconUrl,
            lastAccessed: this.tabHistory[tab.id].lastAccessed,
            frequency: this.tabHistory[tab.id].frequency
        }));
        
        // // Split tabs into relevant and irrelevant tabs
        // //const tabInfoSplit = tabInfo.findIndex(tab => (Date.now() - tab.lastAccessed) > 100000);
        // const tabInfoSplit = tabInfo.findIndex(tab => score[tab.id] < 0.5);

        // const revelanteTabs = tabInfoSplit === -1 ? tabInfo : tabInfo.slice(0, tabInfoSplit);
        // const allTabs = tabInfoSplit === -1 ? [] : tabInfo.slice(tabInfoSplit);

        this.webSocketManager.send({ tabs: tabInfo });
    }

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

// Keep the extension alive (best practice ???)
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
        tabManager.sendTabsToVSCode();
    }
});
