import path from 'path';

import OSManager from "../OSManager";
import FileSystemUtils from "../../utils";

/**
 * WindowsOSManager is a platform-specific implementation of OSManager
 * for Windows operating systems. It provides methods to interact with
 * the browser and manage window focus using system-level commands.
 *
 * This class relies on the external utility `nircmd.exe` for window activation
 * and uses built-in Windows command-line tools like `tasklist` and `start`.
 *
 * Properties:
 * - nircmdPath: Absolute path to the `nircmd.exe` utility used for controlling windows.
 */

class WindowsOSManager extends OSManager {
    private readonly nircmdPath = path.join(__dirname, '../../..', 'resources', 'windowsOS', 'nircmd.exe');
    private readonly navigator : string = 'chrome';
    
    /**
     * Checks whether the browser is currently running.
     * 
     * Uses the `tasklist` command to search for '[navigator].exe' in the list of running processes.
     * 
     * @returns {Promise<boolean>} - A promise that resolves to `true` if browser is running, `false` otherwise.
     */
    async isBrowserOpen(): Promise<boolean> {
        const stdout = await FileSystemUtils.executeCommand(`tasklist /FI "IMAGENAME eq ${this.navigator}.exe"`);
        return stdout.includes(this.navigator + '.exe'); 
    }

    /**
     * Brings the browser window to the foreground.
     * 
     * Uses the external `nircmd.exe` utility to activate the window associated with the `[navigator].exe` process.
     * 
     * @returns {Promise<void>} - A promise that resolves when the browser window is activated.
     */
    async activateBrowser(): Promise<void> {
        await FileSystemUtils.executeCommand(`"${this.nircmdPath}" win activate process ${this.navigator}.exe`);
    }

    /**
     * Brings a window with the specified process ID to the foreground.
     * 
     * Uses the external `nircmd.exe` utility to activate the window associated with the provided process ID.
     * 
     * @param {number} processId - The process ID of the window to activate.
     * @returns {Promise<void>} - A promise that resolves when the window is activated.
     */
    async activateWindow(processId: number): Promise<void> {
        await FileSystemUtils.executeCommand(`"${this.nircmdPath}" win activate handle ${processId}`);
    }

    /**
     * Opens the browser with the specified URL.
     * 
     * Uses the `start` command to open browser with the provided URL.
     * 
     * @param {string} url - The URL to open in the browser.
     * @returns {Promise<void>} - A promise that resolves when the browser is launched with the given URL.
     */
    async openBrowser(url: string): Promise<void> {
        await FileSystemUtils.executeCommand(`start ${this.navigator} "${url}"`);
    }
}

export default WindowsOSManager;