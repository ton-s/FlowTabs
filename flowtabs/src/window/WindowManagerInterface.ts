import { Window } from '../tabScoreCalculator';

interface WindowManagerInterface {
    getWindows(): Window[];
    getAllWindows(): Promise<void>;
    getActiveWindow(): Promise<void>;
    getIcon(window: { id: number; exePath: string }): Promise<void>;
}

export default WindowManagerInterface;