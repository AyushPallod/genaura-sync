export interface SkillYaml {
    id: string;
    name: string;
    version?: string;
    description?: string;
    category?: string;
    triggers?: string[];
    owns?: string[];
    tags?: string[];
    pairs_with?: string[];
    layer?: number;
    identity?: {
        role?: string;
        expertise?: string[];
        tone?: string;
        principles?: string[];
    };
}
export interface SharpEdgesYaml {
    edges?: Array<{
        id: string;
        name: string;
        description?: string;
        detection?: string;
        severity?: 'critical' | 'high' | 'medium' | 'low';
        solution?: string;
    }>;
}
export interface ValidationsYaml {
    validations?: Array<{
        id: string;
        name: string;
        type?: string;
        pattern?: string;
        message?: string;
    }>;
}
export interface CollaborationYaml {
    delegates_to?: Array<{
        skill_id: string;
        when?: string;
    }>;
    receives_from?: Array<{
        skill_id: string;
        context?: string;
    }>;
}
export interface ParsedSkill {
    id: string;
    name: string;
    path: string;
    source: 'local' | 'remote' | 'community';
    skillYaml?: SkillYaml;
    sharpEdgesYaml?: SharpEdgesYaml;
    validationsYaml?: ValidationsYaml;
    collaborationYaml?: CollaborationYaml;
    hasPatternsMd: boolean;
    hasAntiPatternsMd: boolean;
    hasDecisionsMd: boolean;
    hasSharpEdgesMd: boolean;
}
export interface QualityScore {
    total: number;
    breakdown: {
        identity: number;
        sharpEdges: number;
        validations: number;
        collaboration: number;
    };
    gaps: string[];
    strengths: string[];
}
export interface ScoredSkill extends ParsedSkill {
    score: QualityScore;
}
export interface OverlapGroup {
    domain: string;
    skills: ScoredSkill[];
    recommendation: {
        best: ScoredSkill;
        reason: string;
        alternatives: Array<{
            skill: ScoredSkill;
            useCase: string;
        }>;
    };
}
export interface RatingReport {
    timestamp: string;
    totalSkills: number;
    averageScore: number;
    tiers: {
        excellent: ScoredSkill[];
        good: ScoredSkill[];
        mediocre: ScoredSkill[];
        poor: ScoredSkill[];
    };
    overlaps: OverlapGroup[];
    contradictions: Array<{
        skillA: string;
        skillB: string;
        conflict: string;
        resolution: string;
    }>;
}
