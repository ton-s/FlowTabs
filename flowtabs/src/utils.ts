import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

class FileSystemUtils {
    static async createDirectory(directoryPath: string): Promise<void> {
        try {
            await fs.promises.mkdir(directoryPath, { recursive: true });
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    }

    static async executeCommand(command: string): Promise<any> {
        try {
            const { stdout } = await promisify(exec)(command);
            return stdout;
        } catch (error) {
            console.error('Error executing command:', error);
        }
    }
}

export default FileSystemUtils;