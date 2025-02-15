import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const WEBSOCKET_PORT = 5000;

// Interface representing a tab
interface Tab {
    id: number;
    title: string;
    url: string;
    icon: string;
}

// Abstract class for browser compatibility
abstract class BrowserManager {
    abstract isBrowserOpen(): Promise<boolean>;
    abstract activateBrowser(): Promise<void>;
    abstract openBrowser(url: string): Promise<void>;
    
    async sendMessage(wsClient: WebSocket | null, action: string, payload: object): Promise<void> {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            try {
                wsClient.send(JSON.stringify({ action, ...payload }));
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
            }
        }
    }
}

// Chrome-specific implementation
class ChromeManager extends BrowserManager {
    private readonly nircmdPath = path.join(__dirname, '..', 'resources', 'nircmd.exe');
    
    async isBrowserOpen(): Promise<boolean> {
        try {
            const { stdout } = await promisify(exec)('tasklist /FI "IMAGENAME eq chrome.exe"');
            return stdout.includes('chrome.exe');
        } catch (error) {
            console.error('Error checking Chrome status:', error);
            return false;
        }
    }
    
    async activateBrowser(): Promise<void> {
        try {
            await promisify(exec)(`"${this.nircmdPath}" win activate process chrome.exe`);
        } catch (error) {
            console.error('❌ Error activating Chrome:', error);
        }
    }
    
    async openBrowser(url: string): Promise<void> {
        try {
            await promisify(exec)(`start chrome "${url}"`);
        } catch (error) {
            console.error('❌ Error opening Chrome:', error);
        }
    }
}

// Data provider for the tab TreeView
class TabTreeDataProvider implements vscode.TreeDataProvider<Tab> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<Tab | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Tab | undefined> = this._onDidChangeTreeData.event;
    private tabs: Tab[] = [];

    getTreeItem(element: Tab): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        treeItem.iconPath = element.icon ? vscode.Uri.parse(element.icon) : new vscode.ThemeIcon('globe');
        return treeItem;
    }
    
    getChildren(): Thenable<Tab[]> {
        return Promise.resolve(this.tabs.filter(tab => !tab.url.startsWith('chrome://')));
    }
    
    updateTabs(tabs: Tab[]): void {
        this.tabs = tabs;
        this._onDidChangeTreeData.fire(undefined);
    }
}

// Main extension activation function
export function activate(context: vscode.ExtensionContext): void {
    const wss = new WebSocket.Server({ port: Number(WEBSOCKET_PORT) });
    let wsClient: WebSocket | null = null;
    const browserManager = new ChromeManager();
    const tabTreeDataProvider = new TabTreeDataProvider();
    const tabView = vscode.window.createTreeView('tabSyncView', { treeDataProvider: tabTreeDataProvider });

    wss.on('connection', (ws: WebSocket) => {
        console.log('✅ Client connected');
        wsClient = ws;

        ws.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message.toString()) as { tabs: Tab[] };
                tabTreeDataProvider.updateTabs(data.tabs);
            } catch (error) {
                console.error('❌ Error receiving data:', error);
            }
        });

        ws.on('close', () => {
            console.log('❌ Client disconnected');
            wsClient = null;
            tabTreeDataProvider.updateTabs([]);
        });
    });

    tabView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
            browserManager.activateBrowser()
                .then(() => browserManager.sendMessage(wsClient, 'activateTab', { id: e.selection[0].id }));
        }
    });

    const searchCommand = vscode.commands.registerCommand('flowtabs.search', async () => {
        const query = (await vscode.window.showInputBox({
            prompt: "Enter a search",
            placeHolder: "Enter your search here..."
        }))?.trim();
        
        if (query) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            browserManager.isBrowserOpen()
                .then(isOpen => isOpen ? browserManager.activateBrowser() : browserManager.openBrowser(searchUrl))
                .then(() => browserManager.sendMessage(wsClient, 'search', { url: searchUrl }));
        } else {
            console.warn('⚠️ No search query entered');
        }
    });
    
    context.subscriptions.push(searchCommand);
}

export function deactivate(): void {
    console.log('🛑 WebSocket extension stopped.');
}
