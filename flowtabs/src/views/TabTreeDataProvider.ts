import * as vscode from 'vscode';
import { TabOrWindow } from '../tabScoreCalculator';

// Data provider for the tab TreeView
class TabTreeDataProvider implements vscode.TreeDataProvider<TabOrWindow> {
    protected readonly _onDidChangeTreeData = new vscode.EventEmitter<TabOrWindow | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TabOrWindow | undefined> = this._onDidChangeTreeData.event;

    protected tabs: TabOrWindow[] = [];
    private readonly tabScoreCalculator: any;

    constructor(tabScoreCalculator: any) {
        this.tabScoreCalculator = tabScoreCalculator;
    }

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

        treeItem.contextValue = this.tabScoreCalculator.checkFavoriteTab(element) ? 'favoriteTab' : 'tab';

        return treeItem;
    }

    getChildren(): Thenable<TabOrWindow[]> {
        return Promise.resolve(this.tabs.filter(tab => {
            if ('url' in tab) {
                return !tab.url.startsWith('chrome://newtab/'); // Filter out new tab pages
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

export default TabTreeDataProvider;