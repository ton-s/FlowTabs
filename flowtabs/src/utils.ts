
// Interface representing a tab
export interface Tab {
    id: number;
    title: string;
    url: string;
    icon: string;
    lastAccessed: number;
    frequency: number;
}


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
 * A class to calculate scores for a list of tabs based on their frequency and recency.
 * It calculates individual scores and splits tabs into relevant and non-relevant ones.
 * 
 * @class TabScoreCalculator
 */
class TabScoreCalculator {
    private tabs: Tab[]; // The list of tabs to be evaluated.
    private favoriteTabs: Tab[]; // The list of favorite tabs.

    constructor(tabs: Tab[]) {
        this.tabs = tabs;
        this.favoriteTabs = [];
    }


    /**
     * Updates the list of tabs to be evaluated.
     * 
     * @public
     * @param {Tab[]} newTabs The new list of tabs to be evaluated.
     */
    public updateTabs(newTabs: Tab[]): void {
        this.tabs = newTabs;
    }


    public checkFavoriteTab(tab: Tab): boolean {
        return this.favoriteTabs.some((t: Tab) => t.id === tab.id);
    }

    public addFavoriteTab(tab: Tab): void {
        if (!this.checkFavoriteTab(tab)) {
            this.favoriteTabs.push(tab);
        }
    }

    public removeFavoriteTab(tab: Tab): void {
        this.favoriteTabs = this.favoriteTabs.filter((t: Tab) => t.id !== tab.id); 
    }

    /**
     * Calculates the frequency-based score for each tab.
     * The score is computed as the frequency of a tab divided by the sum of all tab frequencies.
     * 
     * @private
     * @returns {ScoreMap} A map where each key is a tab ID, and the value is the frequency score.
     */
    private calculateFrequency(): ScoreMap {
        const sumFrequency = this.tabs.reduce((acc: number, curr: Tab) => acc + (curr.frequency || 0), 0);

        console.log("Sum Frequency : ", sumFrequency);
        const scoreFrequency: ScoreMap = {};
        this.tabs.forEach((tab: Tab) => {
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

        this.tabs.forEach((tab: Tab) => {
            const elapsedTime = (Date.now() - tab.lastAccessed) / 60000;
            console.log("Elapsed Time:", elapsedTime);
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

        this.tabs.forEach((tab: Tab) => {
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
    * @returns {{ allTabs: Tab[], relevantTabs: Tab[] }} An object containing two arrays:
    *      - allTabs: The list of non-relevant tabs (those with a score below 0.5).
    *      - relevantTabs: The list of relevant tabs (those with a score of 0.5 or higher).
    */
    public getScore(): { allTabs: Tab[], relevantTabs: Tab[] } {
        const score = this.calculateScore();

        // Sort tabs based on their scores in descending order
        this.tabs.sort((a: Tab, b: Tab) => score[b.id] - score[a.id]);

        const favoriteTabs = this.tabs.filter((tab: Tab) => this.checkFavoriteTab(tab));
        const otherTabs = this.tabs.filter((tab: Tab) => !this.checkFavoriteTab(tab));


        // Split the list of tabs into relevant and non-relevant tabs
        const tabInfoSplit = otherTabs.findIndex((tab: Tab) => score[tab.id] < 0.5);

        const relevantTabs = tabInfoSplit === -1 ? otherTabs : otherTabs.slice(0, tabInfoSplit).concat(favoriteTabs);
        const allTabs = tabInfoSplit === -1 ? [] : otherTabs.slice(tabInfoSplit);

        console.log("Relevant Tabs:", relevantTabs);
        console.log("Favorite Tabs:", this.favoriteTabs);

        return { allTabs, relevantTabs };


    }

}

export default TabScoreCalculator;