export interface SkillSnapshot {
    id: string;
    hash: string;
    files: {
        name: string;
        hash: string;
    }[];
    timestamp: string;
}
export interface DiffResult {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
}
export interface TargetDiff {
    target: string;
    sourceSkills: string[];
    targetSkills: string[];
    diff: DiffResult;
}
export declare function getSnapshotPath(): string;
export declare function loadSnapshot(): Map<string, SkillSnapshot> | null;
export declare function saveSnapshot(skills: Map<string, SkillSnapshot>): void;
export declare function createSnapshot(sourcePath: string): Map<string, SkillSnapshot>;
export declare function diffSnapshots(previous: Map<string, SkillSnapshot> | null, current: Map<string, SkillSnapshot>): DiffResult;
export declare function diffSourceToTarget(sourcePath: string, targetPath: string): DiffResult;
export declare function getTargetDiffs(sourcePath: string, targets: {
    name: string;
    path: string;
}[]): TargetDiff[];
