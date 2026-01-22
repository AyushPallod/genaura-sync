import type { ParsedSkill } from './types.js';
export interface ScanOptions {
    paths?: string[];
    includeRemote?: boolean;
}
export declare function scanSkills(options?: ScanOptions): Promise<ParsedSkill[]>;
export declare function getDefaultPaths(): string[];
