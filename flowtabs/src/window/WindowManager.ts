import path from 'path';

import FileSystemUtils from '../utils';
import { Window } from '../tabScoreCalculator';

class WindowManager {
    private readonly getAllWindowsScript = path.resolve(__dirname, '../..', 'resources', 'windowsOS', 'windowsProcess.ps1');
    private readonly getActiveWindowScript = path.resolve(__dirname, '../..', 'resources', 'windowsOS', 'getActiveWindow.ps1');
    private readonly getWindowIconScript = path.resolve(__dirname, '../..', 'resources', 'windowsOS', 'getWindowIcon.ps1');

    protected windows: Window[] = [];
    private lastWindow: number = 0;

    private readonly excludedProcesses: Set<string> = new Set(['chrome', 'code']);


    getWindows(): Window[] {
        return this.windows;
    }

    // Get all windows and update the list of windows
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

    // get the active window and update the last accessed time
    async getActiveWindow(): Promise<void> {
        const command = `powershell -ExecutionPolicy RemoteSigned -File "${this.getActiveWindowScript}"`;
        const activeWindowIdRaw = await FileSystemUtils.executeCommand(command);
        const activeWindowId = activeWindowIdRaw.trim();

        const activeWindow = this.windows.find(w => w.id === activeWindowId);
        if (activeWindow) {
            activeWindow.lastAccessed = Date.now();
            this.updateWindowsFrequency(activeWindowId);
        }

        this.lastWindow = activeWindowId;
    }

    private updateWindowsFrequency(activeWindowId: number): void {
        const window = this.windows.find(w => w.id === activeWindowId);

        if (window && activeWindowId !== this.lastWindow) {
            window.frequency = window.frequency ? window.frequency + 1 : 1;
        }

    }

    async getIcon(window: { id: number; exePath: string }): Promise<void> {
        const iconPath: string = path.resolve(__dirname, '../..', 'assets', 'icons', `${window.id}.png`);
        const iconsDir = path.resolve(__dirname, '../..', 'assets', 'icons');


        await FileSystemUtils.createDirectory(iconsDir);

        const command = `powershell -ExecutionPolicy RemoteSigned -File "${this.getWindowIconScript}"`;

        await FileSystemUtils.executeCommand(`${command} "${window.exePath}" "${iconPath}"`);


        this.windows.find(w => w.id === window.id)!.icon = `../../assets/icons/${window.id}.png`;

    }

}

export default WindowManager;