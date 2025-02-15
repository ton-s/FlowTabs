import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Interface representing a tab
interface Tab {
    id: number;
    title: string;
    url: string;
    icon: string;
}

// Data provider for the tab TreeView
class TabTreeDataProvider implements vscode.TreeDataProvider<Tab> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<Tab | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Tab | undefined> = this._onDidChangeTreeData.event;

    private tabs: Tab[] = [];

    /**
     * Returns the tree item for a given tab.
     * @param element - The tab element.
     * @returns The TreeItem representation of the tab.
     */
    getTreeItem(element: Tab): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        treeItem.iconPath = element.icon ? vscode.Uri.parse(element.icon) : new vscode.ThemeIcon('globe');
        return treeItem;
    }

    /**
     * Returns the children of a tab element (if any).
     * @param element - The tab element.
     * @returns A promise resolving to an array of tabs, or an empty array if no element is selected.
     */
    getChildren(element?: Tab): Thenable<Tab[]> {
        if (element) {
            return Promise.resolve([]); // No children for a selected tab
        }
        // Return all tabs excluding those starting with "chrome://"
        return Promise.resolve(this.tabs.filter(tab => !tab.url.startsWith('chrome://')));
    }

    /**
     * Updates the list of tabs in the TreeView.
     * @param tabs - The new list of tabs.
     */
    updateTabs(tabs: Tab[]): void {
        this.tabs = tabs;
        this._onDidChangeTreeData.fire(undefined); // Notify that the tree data has changed
    }
}

// Function to send a WebSocket message
/**
 * Sends a WebSocket message if the client is connected and ready.
 * @param wsClient - The WebSocket client.
 * @param action - The action to be sent.
 * @param payload - The payload data for the action.
 */
async function sendWebSocketMessage(wsClient: WebSocket | null, action: string, payload: object): Promise<void> {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({ action, ...payload }));
    }
}

// Activate Chrome before sending a WebSocket message
/**
 * Activates Chrome using an external tool (nircmd.exe) and sends a WebSocket message.
 * @param wsClient - The WebSocket client.
 * @param action - The action to be sent.
 * @param payload - The payload data for the action.
 */
async function activateChromeAndSend(wsClient: WebSocket | null, action: string, payload: object): Promise<void> {
    const nircmdPath = path.join(__dirname, '..', 'resources', 'nircmd.exe');
    try {
        // Activates Chrome using the nircmd tool
        await promisify(exec)(`"${nircmdPath}" win activate process chrome.exe`);
        // Sends the WebSocket message after activation
        await sendWebSocketMessage(wsClient, action, payload);
    } catch (error) {
        console.error('❌ Error activating Chrome:', error);
    }
}

// Handle tab selection
/**
 * Handles the event when a tab is selected from the TreeView.
 * @param e - The selection change event.
 * @param wsClient - The WebSocket client.
 */
function handleTabSelection(e: vscode.TreeViewSelectionChangeEvent<Tab>, wsClient: WebSocket | null): void {
    if (e.selection.length > 0) {
        // Send the 'activateTab' message when a tab is selected
        activateChromeAndSend(wsClient, 'activateTab', { id: e.selection[0].id });
    }
}

// Check if Chrome is open
/**
 * Checks whether Chrome is currently running.
 * @returns A promise that resolves to true if Chrome is open, false otherwise.
 */
async function isChromeOpen(): Promise<boolean> {
    try {
        const { stdout } = await promisify(exec)('tasklist /FI "IMAGENAME eq chrome.exe"');
        return stdout.includes('chrome.exe');
    } catch (error) {
        console.error('Error checking Chrome status:', error);
        return false;
    }
}

// Open Chrome with a URL
/**
 * Opens Chrome with the provided URL if Chrome is not already running.
 * @param url - The URL to be opened in Chrome.
 */
async function openChrome(url: string): Promise<void> {
    try {
        await promisify(exec)(`start chrome "${url}"`);
    } catch (error) {
        console.error('❌ Error opening Chrome:', error);
    }
}

// Extension activation function
/**
 * The function that is triggered when the extension is activated.
 * It initializes the WebSocket server and listens for incoming connections.
 * It also registers the search command.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
    const wss = new WebSocket.Server({ port: 5000 });
    let wsClient: WebSocket | null = null;

    const tabTreeDataProvider = new TabTreeDataProvider();
    const tabView = vscode.window.createTreeView('tabSyncView', {
        treeDataProvider: tabTreeDataProvider
    });

    // WebSocket connection handling
    wss.on('connection', (ws: WebSocket) => {
        console.log('✅ Client connected');
        wsClient = ws;

        // Handle incoming messages
        ws.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message.toString()) as { tabs: Tab[] };
                tabTreeDataProvider.updateTabs(data.tabs);
            } catch (error) {
                console.error('❌ Error receiving data:', error);
            }
        });

        // Handle disconnection
        ws.on('close', () => {
            console.log('❌ Client disconnected');
            wsClient = null;
        });
    });

    // Handle tab selection change
    tabView.onDidChangeSelection((e) => {
        handleTabSelection(e, wsClient);
    });

    // Register the search command
    const searchCommand = vscode.commands.registerCommand('flowtabs.search', async () => {
        const query = await vscode.window.showInputBox({
            prompt: "Enter a search",
            placeHolder: "Enter your search here..."
        });

        if (query) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

            if (await isChromeOpen()) {
                activateChromeAndSend(wsClient, 'search', { url: searchUrl });
            } else {
                openChrome(searchUrl);
            }
        }
    });

    context.subscriptions.push(searchCommand);
}

// Extension deactivation function
/**
 * The function that is triggered when the extension is deactivated.
 * It logs a message indicating that the WebSocket extension has stopped.
 */
export function deactivate(): void {
    console.log('🛑 WebSocket extension stopped.');
}
