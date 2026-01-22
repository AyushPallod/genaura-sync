import type { ParsedSkill, ScoredSkill } from './types.js';
export declare function scoreSkill(skill: ParsedSkill): ScoredSkill;
export declare function scoreAllSkills(skills: ParsedSkill[]): ScoredSkill[];
export declare function getTier(score: number): 'excellent' | 'good' | 'mediocre' | 'poor';
