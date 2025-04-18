
// Interface representing a tab
export interface Tab {
    id: number;
    title: string;
    url: string;
    icon: string;
    lastAccessed: number;
    frequency: number;
}

// Interface representing a window
export interface Window {
    id: number;
    title: string;
    processName: string;
    icon: string;
    exePath: string;
    lastAccessed: number;
    frequency: number;
}

export type TabOrWindow = Tab | Window;


/**
 * Represents a map of tab IDs to their associated scores.
 * 
 * @interface ScoreMap
 * @property {number} [key: number] - The tab ID.
 * @property {number} [value: number] - The calculated score associated with the tab ID.
 */
interface ScoreMap {
    [key: number]: number;
}


/**
 * A class to calculate scores for a list of tabs and windows based on their frequency and recency.
 * It calculates individual scores and splits tabs into relevant and non-relevant ones.
 * 
 * @class TabScoreCalculator
 */
class TabScoreCalculator {
    private tabs: TabOrWindow[]; // The list of tabs and/or windows to be evaluated.
    private newTabs: Tab[] = [];
    private newWindows: Window[] = [];
    private favoriteTabs: TabOrWindow[]; // The list of favorite tabs and/or windows.

    constructor(tabs: TabOrWindow[]) {
        this.tabs = tabs;
        this.favoriteTabs = [];
    }

    public updateItems<T extends Tab | Window>(items: T[], type: "tabs" | "windows"): void {
        if (type === "tabs") {
            this.newTabs = items as Tab[];  // Cast to Tab[] for safety
        } else if (type === "windows") {
            this.newWindows = items as Window[];  // Cast to Window[] for safety
        }
    }
    
    public checkFavoriteTab(tab: TabOrWindow): boolean {
        return this.favoriteTabs.some((t: TabOrWindow) => t.id === tab.id);
    }

    public addFavoriteTab(tab: TabOrWindow): void {
        if (!this.checkFavoriteTab(tab)) {
            this.favoriteTabs.push(tab);
        }
    }

    public removeFavoriteTab(tab: TabOrWindow): void {
        this.favoriteTabs = this.favoriteTabs.filter((t: TabOrWindow) => t.id !== tab.id);
    }

    /**
     * Calculates the frequency-based score for each tab.
     * The score is computed as the frequency of a tab divided by the sum of all tab frequencies.
     * 
     * @private
     * @returns {ScoreMap} A map where each key is a tab ID, and the value is the frequency score.
     */
    private calculateFrequency(): ScoreMap {
        const sumFrequency = this.tabs.reduce((acc: number, curr: TabOrWindow) => acc + (curr.frequency || 0), 0);

        //console.log("Sum Frequency : ", sumFrequency);
        const scoreFrequency: ScoreMap = {};
        this.tabs.forEach((tab: TabOrWindow) => {
            scoreFrequency[tab.id] = tab.frequency / sumFrequency || 0;
        });
        console.log("Frequency Scores:", scoreFrequency);
        return scoreFrequency;

    }

    /**
     * Calculates the recency-based score for each tab.
     * The score is computed based on the elapsed time since the last access, using an exponential decay function.
     * 
     * @private
     * @returns {ScoreMap} A map where each key is a tab ID, and the value is the recency score.
     */
    private calculateRecency(): ScoreMap {
        const scoreRecency: ScoreMap = {};
        const lambda = 0.07;

        this.tabs.forEach((tab: TabOrWindow) => {
            const elapsedTime = (Date.now() - tab.lastAccessed) / 60000;
            scoreRecency[tab.id] = Math.exp(-lambda * elapsedTime) || 0;

        });
        console.log("Relevance Scores:", scoreRecency);
        return scoreRecency;
    }

    /**
     * Calculates the final score for each tab by combining frequency and recency scores.
     * The final score is calculated as a weighted sum of frequency and recency scores, using alpha and beta as weights.
     * 
     * @private
     * @returns {ScoreMap} A map where each key is a tab ID, and the value is the final score.
     */
    private calculateScore(): ScoreMap {
        const score: ScoreMap = {};
        const alpha = 0.3;
        const beta = 0.7;

        this.tabs.forEach((tab: TabOrWindow) => {
            score[tab.id] = alpha * this.calculateFrequency()[tab.id] + beta * this.calculateRecency()[tab.id];
        }
        );
        console.log("Final Scores:", score);
        return score;
    }

    /**
    * Returns the list of tabs, split into relevant and non-relevant tabs based on their scores.
    * Relevant tabs are those with a score above a certain threshold.
    * 
    * @public
    * @returns {{ allTabs: TabOrWindow[], relevantTabs: TabOrWindow[] }} An object containing two arrays:
    *      - allTabs: The list of non-relevant tabs (those with a score below 0.5).
    *      - relevantTabs: The list of relevant tabs (those with a score of 0.5 or higher).
    */
    public getScore(): { allTabs: TabOrWindow[], relevantTabsWithFavorites: TabOrWindow[] } {
        this.tabs = [...this.newTabs, ...this.newWindows];
        
        const score = this.calculateScore();

        // Sort tabs based on their scores in descending order
        this.tabs.sort((a: TabOrWindow, b: TabOrWindow) => score[b.id] - score[a.id]);

        const favoriteTabs = this.tabs.filter((tab: TabOrWindow) => this.checkFavoriteTab(tab));
        const otherTabs = this.tabs.filter((tab: TabOrWindow) => !this.checkFavoriteTab(tab));

        // Split the list of tabs into relevant and non-relevant tabs
        const tabInfoSplit = otherTabs.findIndex((tab: TabOrWindow) => score[tab.id] < 0.5);

        const relevantTabs = tabInfoSplit === -1 ? otherTabs : otherTabs.slice(0, tabInfoSplit);
        const relevantTabsWithFavorites = relevantTabs.concat(favoriteTabs);
        const allTabs = tabInfoSplit === -1 ? [] : otherTabs.slice(tabInfoSplit);

        console.log("Relevant Tabs:", relevantTabs);
        console.log("Favorite Tabs:", this.favoriteTabs);

        return { allTabs, relevantTabsWithFavorites };

    }

}

export default TabScoreCalculator;