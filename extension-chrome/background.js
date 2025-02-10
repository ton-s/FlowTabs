class WebSocketManager {
    constructor() {
        this.ws = null;
        this.WS_URL = "ws://localhost:5000";
        this.RECONNECT_INTERVAL = 3000;
        this.tabManager = null; // Sera défini plus tard
        this.connect();
    }

    setTabManager(tabManager) {
        this.tabManager = tabManager;
    }

    connect() {
        console.log("🔄 Tentative de connexion à WebSocket...");

        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
            console.log("✅ Connexion WebSocket établie !");
            if (this.tabManager) {
                this.tabManager.sendTabsToVSCode();
            }
        };

        this.ws.onmessage = (message) => {
            try {
                const data = JSON.parse(message.data);
                if (data.action === "activateTab" && this.tabManager) {
                    this.tabManager.activateTab(data.url);
                    console.log("📥 Activation de l'onglet :", data.url);
                }
            } catch (error) {
                console.error("❌ Erreur lors de la réception du message :", error);
            }
        };

        this.ws.onerror = (error) => {
            console.error("❌ Erreur WebSocket :", error);
            this.reconnect();
        };

        this.ws.onclose = () => {
            console.warn("⚠️ Connexion WebSocket fermée, tentative de reconnexion...");
            this.reconnect();
        };
    }

    reconnect() {
        setTimeout(() => {
            console.log("🔄 Reconnexion au WebSocket...");
            this.connect();
        }, this.RECONNECT_INTERVAL);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            console.log("📤 Données envoyées :", data);
        } else {
            console.warn("⚠️ WebSocket non connecté. Tentative de réenvoi plus tard...");
        }
    }
}

class TabManager {
    constructor(webSocketManager) {
        this.tabHistory = {}; // Stocke la dernière consultation des onglets
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

        // Mise à jour des timestamps pour les nouveaux onglets
        tabs.forEach(tab => {
            if (!this.tabHistory[tab.id]) {
                this.updateTabHistory(tab.id);
            }
        });

        // Trier les onglets par dernière consultation
        tabs.sort((a, b) => (this.tabHistory[b.id]?.lastAccessed || 0) - (this.tabHistory[a.id]?.lastAccessed || 0));

        const tabInfo = tabs.map(tab => ({
            title: tab.title,
            url: tab.url,
            icon: tab.favIconUrl,
            lastAccessed: this.tabHistory[tab.id]?.lastAccessed || 0
        }));

        this.webSocketManager.send({ tabs: tabInfo });
    }

    activateTab(tabUrl) {
        chrome.tabs.query({ url: tabUrl }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                this.updateTabHistory(tabs[0].id);
                this.sendTabsToVSCode();
            }
        });
    }
}

// ✅ Initialisation propre des objets sans dépendance circulaire
const webSocketManager = new WebSocketManager();
const tabManager = new TabManager(webSocketManager);
webSocketManager.setTabManager(tabManager);
