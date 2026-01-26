export interface SkillYaml {
  id: string;
  name: string;
  version?: string;
  description?: string;
  category?: string;
  targets?: string[];
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
  
  // Raw YAML content
  skillYaml?: SkillYaml;
  sharpEdgesYaml?: SharpEdgesYaml;
  validationsYaml?: ValidationsYaml;
  collaborationYaml?: CollaborationYaml;
  
  // Markdown content exists
  hasPatternsMd: boolean;
  hasAntiPatternsMd: boolean;
  hasDecisionsMd: boolean;
  hasSharpEdgesMd: boolean;
}

export interface QualityScore {
  total: number; // 0-100
  breakdown: {
    identity: number;      // 0-25: Role clarity, expertise depth, principles
    sharpEdges: number;    // 0-25: Edge coverage, detection patterns, solutions
    validations: number;   // 0-25: Validation coverage, patterns, messages
    collaboration: number; // 0-25: Delegation rules, integration points
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
  
  // Tier breakdown
  tiers: {
    excellent: ScoredSkill[];  // 80-100
    good: ScoredSkill[];       // 60-79
    mediocre: ScoredSkill[];   // 40-59
    poor: ScoredSkill[];       // 0-39
  };
  
  // Overlap analysis
  overlaps: OverlapGroup[];
  
  // Contradictions (conflicting patterns between skills)
  contradictions: Array<{
    skillA: string;
    skillB: string;
    conflict: string;
    resolution: string;
  }>;
}
