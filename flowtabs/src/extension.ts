import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as path from 'path';
import { exec } from 'child_process';

// Interface représentant un onglet
interface Tab {
    title: string;
    url: string;
    icon: string;
    favorite?: boolean;
}

// Fournisseur de données pour le TreeView des onglets
class TabTreeDataProvider implements vscode.TreeDataProvider<Tab> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<Tab | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Tab | undefined> = this._onDidChangeTreeData.event;

    private tabs: Tab[] = []; // Liste des onglets

    constructor() {}

    // Retourne l'élément de l'arbre (TreeItem) pour un onglet
    getTreeItem(element: Tab): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);

        // Si l'onglet a une icône, l'ajouter à l'élément, sinon utiliser une icône par défaut
        treeItem.iconPath = element.icon ? vscode.Uri.parse(element.icon) : new vscode.ThemeIcon('globe');
        return treeItem;
    }

    // Retourne les enfants de l'élément (ici, les onglets)
    getChildren(element?: Tab): Thenable<Tab[]> {
        // Si un élément est sélectionné, il n'y a pas d'enfants
        if (element) {
            return Promise.resolve([]);
        }
        
        // Filtrer les onglets, excluant ceux qui commencent par "chrome://"
        const filteredTabs = this.tabs.filter(tab => !tab.url.startsWith('chrome://'));
        return Promise.resolve(filteredTabs);
    }

    // Met à jour la liste des onglets dans le TreeView
    updateTabs(tabs: Tab[]): void {
        this.tabs = tabs;
        this._onDidChangeTreeData.fire(undefined); // Notifie les changements
    }
}

// Fonction pour activer l'onglet dans le navigateur via WebSocket
function activateTabInBrowser(tab: Tab, wsClient: WebSocket | null): void {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        const nircmdPath = path.join(__dirname, '..', 'resources', 'nircmd.exe');
        exec(`"${nircmdPath}" win activate process chrome.exe`, (err) => {
            if (err) {
                console.error('Erreur lors de l\'activation de Chrome:', err);
            }
        });

        // Envoyer l'URL de l'onglet via WebSocket
        wsClient.send(JSON.stringify({ action: 'activateTab', url: tab.url }));
    }
}

// Fonction pour gérer la sélection d'un onglet dans une vue
function handleTabSelection(e: vscode.TreeViewSelectionChangeEvent<Tab>, wsClient: WebSocket | null): void {
    if (e.selection.length > 0) {
        const selectedTab = e.selection[0];
        console.log('Onglet sélectionné:', selectedTab);
        activateTabInBrowser(selectedTab, wsClient); // Appel à la fonction qui gère l'activation de l'onglet
    }
}


// Fonction activée lors de l'activation de l'extension
export function activate(context: vscode.ExtensionContext): void {
    const wss = new WebSocket.Server({ port: 5000 });
    let wsClient: WebSocket | null = null;

    // Créer le fournisseur de données pour le TreeView
    const tabTreeDataProvider = new TabTreeDataProvider();

    // Enregistrer les vues du TreeView dans le panneau latéral
    const tabFavoritesView = vscode.window.createTreeView('favorites', {
        treeDataProvider: tabTreeDataProvider
    });

    const tabView = vscode.window.createTreeView('tabSyncView', {
        treeDataProvider: tabTreeDataProvider
    });

    // Gestion des connexions WebSocket
    wss.on('connection', (ws: WebSocket) => {
        console.log('✅ Client connecté');

        ws.on('message', (message: string) => {
            wsClient = ws;
            try {
                const data = JSON.parse(message.toString()) as { tabs: Tab[] };
                // Mettre à jour les onglets dans le TreeView
                tabTreeDataProvider.updateTabs(data.tabs);
            } catch (error) {
                console.error('❌ Erreur lors de la réception des données :', error);
            }
        });

        ws.on('close', () => {
            console.log('❌ Client déconnecté');
            wsClient = null;
        });
    });

     // Lorsqu'un onglet est sélectionné dans la vue "tabSyncView"
     tabView.onDidChangeSelection((e) => {
        handleTabSelection(e, wsClient); // Appel à la fonction qui gère la sélection
    });

    tabFavoritesView.onDidChangeSelection((e) => {
        handleTabSelection(e, wsClient);
    });

}

// Fonction appelée lors de la désactivation de l'extension
export function deactivate(): void {
    console.log('🛑 Extension WebSocket arrêtée.');
}
