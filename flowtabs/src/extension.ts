import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as fs from 'fs';

import TabScoreCalculator, { Tab, Window, TabOrWindow } from './tabScoreCalculator';
import FileSystemUtils from './utils';


const WEBSOCKET_PORT = 5000;

const tabScoreCalculator = new TabScoreCalculator([]);

class WindowManager {
    private readonly getAllWindowsScript = path.resolve(__dirname, '..', 'resources', 'windowsOS', 'windowsProcess.ps1');
    private readonly getActiveWindowScript = path.resolve(__dirname, '..', 'resources', 'windowsOS', 'getActiveWindow.ps1');
    private readonly getWindowIconScript = path.resolve(__dirname, '..', 'resources', 'windowsOS', 'getWindowIcon.ps1');

    protected windows: Window[] = [];
    private lastWindow: string = '';

    private readonly excludedProcesses: Set<string> = new Set(['chrome', 'code']);

    // Méthode pour récupérer toutes les fenêtres
    async getAllWindows(): Promise<void> {
        const command = `powershell -ExecutionPolicy RemoteSigned -File "${this.getAllWindowsScript}"`;

        const stdout = await FileSystemUtils.executeCommand(command);
        const data = JSON.parse(stdout);

        data.forEach((d: any) => {
            const existingWindow = this.windows.find(w => w.id === d.id);
            
            if (!existingWindow) {
                this.windows.push(d);
            } else {
                existingWindow.title = d.title;
            }
        });

        this.windows = this.windows.filter(currentw => {
            const isInData = data.some((neww: any) => currentw.id === neww.id);
            const isNotExcluded = !this.excludedProcesses.has(currentw.processName.toLowerCase());
            return isInData && isNotExcluded;
        });

        await Promise.all(
            this.windows
                .filter(w => !w.icon)
                .map(w => this.getIcon(w))
        );
        

        console.log('All windows:', this.windows);
    }

    // Méthode pour récupérer la fenêtre active et la mettre à jour
    async getActiveWindow(): Promise<void> {
        const command = `powershell -ExecutionPolicy RemoteSigned -File "${this.getActiveWindowScript}"`;
        const activeWindowTitleRaw = await FileSystemUtils.executeCommand(command);
        const activeWindowTitle = activeWindowTitleRaw.trim();

        const activeWindow = this.windows.find(w => w.title === activeWindowTitle);
        if (activeWindow) {
            activeWindow.lastAccessed = Date.now();
            this.updateWindowsFrequency(activeWindowTitle);
        }

        this.lastWindow = activeWindowTitle;
    }

    private updateWindowsFrequency(currentWindow: string): void {
        const window = this.windows.find(w => w.title === currentWindow);

        if (window && currentWindow !== this.lastWindow) {
            window.frequency = window.frequency ? window.frequency + 1 : 1;
        }

    }

    async getIcon(window: { id: number; exePath: string }): Promise<void> {
        const iconPath: string = path.resolve(__dirname, '..', 'assets', 'icons', `${window.id}.png`);
        const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');


        await FileSystemUtils.createDirectory(iconsDir);

        const command = `powershell -ExecutionPolicy RemoteSigned -File "${this.getWindowIconScript}"`;

        await FileSystemUtils.executeCommand(`${command} "${window.exePath}" "${iconPath}"`);


        this.windows.find(w => w.id === window.id)!.icon = `../assets/icons/${window.id}.png`;

    }

    public async startUpdatingActiveWindow(tabTreeDataProvider: TabTreeDataProvider,
        revelanteTabTreeDataProvider: TabTreeDataProvider, interval: number = 2000): Promise<void> {
        // Ensuite mettre à jour la fenêtre active périodiquement
        const updateCycle = async () => {
            await this.getAllWindows();
            await this.getActiveWindow();
            tabScoreCalculator.updateItems(this.windows, "windows");
            syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider);

            setTimeout(updateCycle, interval);
        };

        updateCycle();
    }


}


// Abstract class for OS compatibility
abstract class OSManager {
    abstract isBrowserOpen(): Promise<boolean>;
    abstract activateBrowser(): Promise<void>;
    abstract activateWindow(processId: number): Promise<void>;
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

class WindowsOSManager extends OSManager {
    private readonly nircmdPath = path.join(__dirname, '..', 'resources', 'windowsOS', 'nircmd.exe');

    async isBrowserOpen(): Promise<boolean> {
        const stdout = await FileSystemUtils.executeCommand('tasklist /FI "IMAGENAME eq chrome.exe"');
        return stdout.includes('chrome.exe'); 
    }

    async activateBrowser(): Promise<void> {
        await FileSystemUtils.executeCommand(`"${this.nircmdPath}" win activate process chrome.exe`);
    }

    async activateWindow(processId: number): Promise<void> {
        await FileSystemUtils.executeCommand(`"${this.nircmdPath}" win activate handle ${processId}`);
    }

    async openBrowser(url: string): Promise<void> {
        await FileSystemUtils.executeCommand(`start chrome "${url}"`);
    }
}

class OSFactory {

    static getOSManager(): OSManager {
        if (process.platform === 'win32') {
            return new WindowsOSManager();
        } else {
            throw new Error('Unsupported OS');
        }
    }
}

// Data provider for the tab TreeView
class TabTreeDataProvider implements vscode.TreeDataProvider<TabOrWindow> {
    protected readonly _onDidChangeTreeData = new vscode.EventEmitter<TabOrWindow | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TabOrWindow | undefined> = this._onDidChangeTreeData.event;
    protected tabs: TabOrWindow[] = [];

    getTabs(): TabOrWindow[] {
        return this.tabs;
    }

    getTreeItem(element: TabOrWindow): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        if ('url' in element) {

            treeItem.iconPath = element.icon ? vscode.Uri.parse(element.icon) : new vscode.ThemeIcon('globe');
        } else {
            treeItem.iconPath = element.icon ? vscode.Uri.joinPath(vscode.Uri.file(__dirname), element.icon) : new vscode.ThemeIcon('window');
        }

        treeItem.contextValue = tabScoreCalculator.checkFavoriteTab(element) ? 'favoriteTab' : 'tab';

        return treeItem;
    }

    getChildren(): Thenable<TabOrWindow[]> {
        return Promise.resolve(this.tabs.filter(tab => {
            if ('url' in tab) {
                return !tab.url.startsWith('chrome://newtab/');
            } else {
                return tab;
            }
        }));
    }

    updateTabs(tabs: TabOrWindow[]): void {
        this.tabs = tabs;
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}

function syncTabs(tabTreeDataProvider: TabTreeDataProvider, revelanteTabTreeDataProvider: TabTreeDataProvider): void {
    const { allTabs, relevantTabs } = tabScoreCalculator.getScore();
    tabTreeDataProvider.updateTabs(allTabs);
    revelanteTabTreeDataProvider.updateTabs(relevantTabs);
}


// Main extension activation function
export function activate(context: vscode.ExtensionContext): void {
    const wss = new WebSocket.Server({ port: Number(WEBSOCKET_PORT) });
    let wsClient: WebSocket | null = null;
    const browserManager = OSFactory.getOSManager();
    const windowManager = new WindowManager();
    const tabTreeDataProvider = new TabTreeDataProvider();
    const revelanteTabTreeDataProvider = new TabTreeDataProvider();

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
                syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider);

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

    tabView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
            if ("url" in e.selection[0]) {

                browserManager.activateBrowser()
                    .then(() => browserManager.sendMessage(wsClient, 'activateTab', { id: e.selection[0].id }));
            } else {
                browserManager.activateWindow(e.selection[0].id);
            }
        }
    });

    revelanteTabView.onDidChangeSelection((e) => {
        if (e.selection.length > 0) {
            if ("url" in e.selection[0]) {

                browserManager.activateBrowser()
                    .then(() => browserManager.sendMessage(wsClient, 'activateTab', { id: e.selection[0].id }));
            } else {
                browserManager.activateWindow(e.selection[0].id);
            }
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


    const addFavoriteCommand = vscode.commands.registerCommand('flowtabs.addFavorite', async (e) => {
        tabScoreCalculator.addFavoriteTab(e);
        syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider);
    });

    const removeFavoriteCommand = vscode.commands.registerCommand('flowtabs.removeFavorite', async (e) => {
        tabScoreCalculator.removeFavoriteTab(e);
        syncTabs(tabTreeDataProvider, revelanteTabTreeDataProvider);
    });


    context.subscriptions.push(addFavoriteCommand);
    context.subscriptions.push(removeFavoriteCommand);

    windowManager.startUpdatingActiveWindow(tabTreeDataProvider, revelanteTabTreeDataProvider);
}


export function deactivate(): void {
    console.log('🛑 WebSocket extension stopped.');

    const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');
    
    fs.promises.rm(iconsDir, { recursive: true, force: true })
    .then(() => {
        console.log('"icons" folder deleted successfully.');
    })
    .catch((error) => {
        console.error('❌ Error deleting the "icons" folder:', error);
    });

}
