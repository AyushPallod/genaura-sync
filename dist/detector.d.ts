import type { ScoredSkill, OverlapGroup } from './types.js';
interface Contradiction {
    skillA: string;
    skillB: string;
    conflict: string;
    resolution: string;
}
export declare function analyzeOverlaps(skills: ScoredSkill[]): {
    overlaps: OverlapGroup[];
    contradictions: Contradiction[];
};
export {};
