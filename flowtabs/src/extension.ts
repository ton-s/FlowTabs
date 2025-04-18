import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as fs from 'fs';

import TabScoreCalculator, { Tab } from './tabScoreCalculator';
import OSFactory from './os/OSFactory';
import WindowsWindowManager from './window/WindowsWindowManager';
import WindowManagerInterface from './window/WindowManagerInterface';
import TabTreeDataProvider from './views/TabTreeDataProvider';


const WEBSOCKET_PORT = 5000;


function syncTabs(tabTreeDataProvider: TabTreeDataProvider, revelanteTabTreeDataProvider: TabTreeDataProvider,
    tabScoreCalculator: TabScoreCalculator): void {
    const { allTabs, relevantTabsWithFavorites } = tabScoreCalculator.getScore();
    tabTreeDataProvider.updateTabs(allTabs);
    revelanteTabTreeDataProvider.updateTabs(relevantTabsWithFavorites);
}

async function startUpdatingActiveWindow(tabTreeDataProvider: TabTreeDataProvider, revelanteTabTreeDataProvider: TabTreeDataProvider,
     windowManager: WindowManagerInterface, tabScoreCalculator: TabScoreCalculator, interval: number = 2000): Promise<void> {
    // Function to update the active windows
    const updateCycle = async () => {
        await windowManager.getAllWindows();
        await windowManager.getActiveWindow();
        tabScoreCalculator.updateItems(windowManager.getWindows(), "windows");
        syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider, tabScoreCalculator);

        setTimeout(updateCycle, interval);
    };

    updateCycle();
}

/**
 * Handles the selection change event in a VSCode TreeView.
 * Depending on the selected item, this function either activates a browser tab
 * or an operating system window.
 * 
 * If the selected item contains a URL, the function activates the browser and sends a message
 * via WebSocket to activate the corresponding tab. If the item does not contain a URL,
 * the function activates an OS window associated with the selected item.
 * 
 * @param {any} e - The event containing the selection information from the TreeView.
 *                  It is expected to have a `selection` property which is an array
 *                  of selected items. Each item can have an `id` and, in some cases, a `url`.
 * 
 * @param {any} browserManager - An object responsible for interacting with the browser.
 * 
 * @param {WebSocket | null} wsClient - The WebSocket instance used to communicate with a remote client.
 *                                      If `null`, it means no client is connected.
 * 
 * @returns {void} - This function does not return a value. It performs asynchronous actions
 *                   via promises.
 */
function handleSelectionChange(e: any, browserManager: any, wsClient: WebSocket | null): void {
    if (e.selection.length > 0) {
        if ("url" in e.selection[0]) {
            browserManager.activateBrowser()
                .then(() => browserManager.sendMessage(wsClient, 'activateTab', { id: e.selection[0].id }));
        } else {
            browserManager.activateWindow(e.selection[0].id);
        }
    }
}


// Main extension activation function
export function activate(context: vscode.ExtensionContext): void {
    const wss = new WebSocket.Server({ port: Number(WEBSOCKET_PORT) });
    let wsClient: WebSocket | null = null;

    const browserManager = OSFactory.getOSManager();
    const windowManager = new WindowsWindowManager();
    const tabScoreCalculator = new TabScoreCalculator([]);
    
    const tabTreeDataProvider = new TabTreeDataProvider(tabScoreCalculator);
    const revelanteTabTreeDataProvider = new TabTreeDataProvider(tabScoreCalculator);

    const tabView = vscode.window.createTreeView('tabSyncView', {
        treeDataProvider: tabTreeDataProvider
    });
    const revelanteTabView = vscode.window.createTreeView('relevanteTabSyncView', {
        treeDataProvider: revelanteTabTreeDataProvider
    });

    console.log(process.platform);

    wss.on('connection', (ws: WebSocket) => {
        console.log('✅ Client connected');
        wsClient = ws;

        ws.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message.toString()) as { tabs: Tab[] };
                console.log(data);
                tabScoreCalculator.updateItems(data.tabs, "tabs");
                syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider, tabScoreCalculator);

            } catch (error) {
                console.error('❌ Error receiving data:', error);
            }
        });

        ws.on('close', () => {
            console.log('❌ Client disconnected');
            tabTreeDataProvider.refresh();
            revelanteTabTreeDataProvider.refresh();
            tabScoreCalculator.updateItems([], "tabs");
            wsClient = null;
        });
    });


    tabView.onDidChangeSelection((e) => handleSelectionChange(e, browserManager, wsClient));
    revelanteTabView.onDidChangeSelection((e) => handleSelectionChange(e, browserManager, wsClient));
    

    // Register the command to search the browser
    // this command will be triggered when the user enters a search via the "Search" button in the user interface.
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


    const addFavoriteCommand = vscode.commands.registerCommand('flowtabs.addFavorite', async (e) => {
        tabScoreCalculator.addFavoriteTab(e);
        syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider, tabScoreCalculator);
    });

    const removeFavoriteCommand = vscode.commands.registerCommand('flowtabs.removeFavorite', async (e) => {
        tabScoreCalculator.removeFavoriteTab(e);
        syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider, tabScoreCalculator);
    });


    context.subscriptions.push(addFavoriteCommand);
    context.subscriptions.push(removeFavoriteCommand);


    startUpdatingActiveWindow(tabTreeDataProvider, revelanteTabTreeDataProvider, windowManager, tabScoreCalculator);
}


export function deactivate(): void {
    console.log('🛑 WebSocket extension stopped.');

    const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');

    // Delete the "icons" folder if it exists
    fs.promises.rm(iconsDir, { recursive: true, force: true })
        .then(() => {
            console.log('"icons" folder deleted successfully.');
        })
        .catch((error) => {
            console.error('❌ Error deleting the "icons" folder:', error);
        });

}
