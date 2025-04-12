import OSManager from './OSManager';
import WindowsOSManager from './windows/WindowsOSManager';

/**
 * OSFactory is a factory class responsible for instantiating the appropriate
 * OSManager implementation based on the current operating system.
 *
 * Currently, it only supports Windows platforms and will throw an error
 * if used on any unsupported OS.
 *
 * Methods:
 * - getOSManager(): Returns an instance of a platform-specific OSManager.
 *   - If the platform is Windows ('win32'), it returns a WindowsOSManager instance.
 *   - Otherwise, it throws an error indicating the OS is unsupported.
 */
class OSFactory {

    static getOSManager(): OSManager {
        if (process.platform === 'win32') {
            return new WindowsOSManager();
        } else {
            throw new Error('Unsupported OS');
        }
    }
}

export default OSFactory;