import type { ScoredSkill } from './types.js';
export interface SyncTarget {
    name: string;
    path: string;
    exists: boolean;
}
export interface SyncResult {
    target: string;
    linked: number;
    skipped: number;
    updated: number;
    removed: number;
    errors: string[];
}
export interface BackupResult {
    target: string;
    path: string;
    count: number;
}
export interface BackupEntry {
    timestamp: string;
    path: string;
    targets: string[];
}
export declare function getTargets(): SyncTarget[];
export declare function getSourcePath(): string;
export declare function getBackupBaseDir(): string;
export declare function getBackupDir(): string;
export declare function listBackups(): BackupEntry[];
export declare function restoreBackup(backupPath: string, targetName?: string): {
    success: boolean;
    restored: string[];
    errors: string[];
};
export declare function backupTarget(target: SyncTarget, backupDir: string): BackupResult | null;
export declare function syncSkillsToTarget(skills: ScoredSkill[], target: SyncTarget, options?: {
    minScore?: number;
    dryRun?: boolean;
}): SyncResult;
export declare function getExistingSkillsInTarget(target: SyncTarget): string[];
/**
 * Pull skills from a target back to source
 * Only pulls non-symlinked directories (actual local skills)
 */
export declare function pullFromTarget(target: SyncTarget, sourcePath: string, options?: {
    force?: boolean;
}): {
    pulled: string[];
    skipped: string[];
    errors: string[];
};
