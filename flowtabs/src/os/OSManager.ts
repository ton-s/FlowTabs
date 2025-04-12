import WebSocket from 'ws';

/**
 * OSManager is an abstract base class that defines a common interface
 * for operating system-specific implementations to manage browser-related
 * tasks and window focus functionality.
 *
 * Subclasses must implement the following abstract methods:
 * - isBrowserOpen(): Checks if the browser (e.g., Chrome) is currently running.
 * - activateBrowser(): Brings the browser window to the foreground.
 * - activateWindow(processId): Brings a window with the specified process ID to the foreground.
 * - openBrowser(url): Opens the browser with the given URL.
 *
 * Additional method:
 * - sendMessage(wsClient, action, payload): Sends a JSON-formatted WebSocket message
 *   to the given client if the connection is open.
 */
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

export default OSManager;