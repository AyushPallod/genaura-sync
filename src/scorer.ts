import { basename } from 'path';
import type { ParsedSkill, QualityScore, ScoredSkill } from './types.js';

interface ScoringContext {
  allSkillIds: Set<string>;
}

interface ScoringCriteria {
  name: string;
  maxPoints: number;
  evaluate: (skill: ParsedSkill, context?: ScoringContext) => { points: number; reason: string };
}

// Safely convert any value to an array
function toArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [];
}

// Identity scoring (0-25 points)
const identityCriteria: ScoringCriteria[] = [
  {
    name: 'Structure & Integrity',
    maxPoints: 5,
    evaluate: (skill) => {
      let points = 0;
      const folderName = basename(skill.path);
      if (skill.id === folderName) points += 2;
      
      const role = skill.skillYaml?.identity?.role;
      if (role && role.length > 10 && !role.toLowerCase().includes('todo')) {
        points += 3;
        return { points, reason: 'ID matches folder & role defined' };
      }
      return { points, reason: 'Partial structure match' };
    }
  },
  {
    name: 'Has expertise areas',
    maxPoints: 5,
    evaluate: (skill) => {
      const expertise = toArray(skill.skillYaml?.identity?.expertise);
      if (expertise.length === 0) return { points: 0, reason: 'No expertise listed' };
      if (expertise.some((e: string) => e.toLowerCase().includes('todo'))) return { points: 1, reason: 'Expertise contains placeholders' };
      if (expertise.length >= 5) return { points: 5, reason: `${expertise.length} expertise areas` };
      return { points: expertise.length, reason: `${expertise.length} expertise areas` };
    }
  },
  {
    name: 'Has guiding principles',
    maxPoints: 5,
    evaluate: (skill) => {
      const principles = toArray(skill.skillYaml?.identity?.principles);
      if (principles.length === 0) return { points: 0, reason: 'No principles defined' };
      if (principles.length >= 3) return { points: 5, reason: `${principles.length} principles` };
      return { points: principles.length * 2, reason: `${principles.length} principles` };
    }
  },
  {
    name: 'Has triggers',
    maxPoints: 5,
    evaluate: (skill) => {
      const triggers = toArray(skill.skillYaml?.triggers);
      const validTriggers = triggers.filter((t: string) => t.length > 2);
      if (validTriggers.length === 0) return { points: 0, reason: 'No valid triggers' };
      if (validTriggers.length >= 5) return { points: 5, reason: `${validTriggers.length} activation triggers` };
      return { points: validTriggers.length, reason: `${validTriggers.length} triggers` };
    }
  },
  {
    name: 'Scope Definition',
    maxPoints: 5,
    evaluate: (skill) => {
      const owns = toArray(skill.skillYaml?.owns);
      const desc = skill.skillYaml?.description || '';
      
      let points = 0;
      if (owns.length > 0) points += 3;
      if (desc.length > 20 && !desc.toLowerCase().includes('todo')) points += 2;
      
      if (points === 0) return { points: 0, reason: 'No ownership or description' };
      return { points, reason: 'Scope defined' };
    }
  },
];

// Sharp edges scoring (0-25 points)
const sharpEdgesCriteria: ScoringCriteria[] = [
  {
    name: 'Has sharp-edges.yaml',
    maxPoints: 8,
    evaluate: (skill) => {
      const edgeList = toArray(skill.sharpEdgesYaml?.edges);
      if (edgeList.length === 0) return { points: 0, reason: 'No sharp edges defined' };
      if (edgeList.length >= 5) return { points: 8, reason: `${edgeList.length} pitfalls documented` };
      return { points: Math.min(edgeList.length * 2, 8), reason: `${edgeList.length} pitfalls` };
    }
  },
  {
    name: 'Edges have detection patterns',
    maxPoints: 8,
    evaluate: (skill) => {
      const edgeList = toArray(skill.sharpEdgesYaml?.edges);
      if (edgeList.length === 0) return { points: 0, reason: 'No edges to evaluate' };
      const withDetection = edgeList.filter((e: any) => e?.detection && String(e.detection).length > 10);
      const ratio = withDetection.length / edgeList.length;
      return { 
        points: Math.round(ratio * 8), 
        reason: `${withDetection.length}/${edgeList.length} edges have detection patterns`
      };
    }
  },
  {
    name: 'Edges have solutions',
    maxPoints: 5,
    evaluate: (skill) => {
      const edgeList = toArray(skill.sharpEdgesYaml?.edges);
      if (edgeList.length === 0) return { points: 0, reason: 'No edges to evaluate' };
      const withSolution = edgeList.filter((e: any) => 
        e?.solution && 
        String(e.solution).length > 20 &&
        !String(e.solution).toLowerCase().includes('todo')
      );
      const ratio = withSolution.length / edgeList.length;
      return { 
        points: Math.round(ratio * 5), 
        reason: `${withSolution.length}/${edgeList.length} edges have meaningful solutions`
      };
    }
  },
  {
    name: 'Has sharp-edges.md deep dive',
    maxPoints: 4,
    evaluate: (skill) => {
      if (skill.hasSharpEdgesMd) return { points: 4, reason: 'Has detailed sharp-edges.md' };
      return { points: 0, reason: 'No sharp-edges.md documentation' };
    }
  },
];

// Validations scoring (0-25 points)
const validationsCriteria: ScoringCriteria[] = [
  {
    name: 'Has validations.yaml',
    maxPoints: 10,
    evaluate: (skill) => {
      const validationList = toArray(skill.validationsYaml?.validations);
      if (validationList.length === 0) return { points: 0, reason: 'No validations - no quality checks' };
      if (validationList.length >= 5) return { points: 10, reason: `${validationList.length} validations` };
      return { points: validationList.length * 2, reason: `${validationList.length} validations` };
    }
  },
  {
    name: 'Validations have patterns',
    maxPoints: 8,
    evaluate: (skill) => {
      const validationList = toArray(skill.validationsYaml?.validations);
      if (validationList.length === 0) return { points: 0, reason: 'No validations' };
      
      const withValidPattern = validationList.filter((v: any) => {
        if (!v?.pattern || String(v.pattern).length < 5) return false;
        try {
          new RegExp(v.pattern);
          return true;
        } catch {
          return false;
        }
      });
      
      const ratio = withValidPattern.length / validationList.length;
      return { 
        points: Math.round(ratio * 8), 
        reason: `${withValidPattern.length}/${validationList.length} have valid regex patterns`
      };
    }
  },
  {
    name: 'Has patterns.md',
    maxPoints: 4,
    evaluate: (skill) => {
      if (skill.hasPatternsMd) return { points: 4, reason: 'Has detailed patterns.md' };
      return { points: 0, reason: 'No patterns.md documentation' };
    }
  },
  {
    name: 'Has anti-patterns.md',
    maxPoints: 3,
    evaluate: (skill) => {
      if (skill.hasAntiPatternsMd) return { points: 3, reason: 'Has anti-patterns.md' };
      return { points: 0, reason: 'No anti-patterns.md' };
    }
  },
];

// Collaboration scoring (0-25 points)
const collaborationCriteria: ScoringCriteria[] = [
  {
    name: 'Has collaboration.yaml',
    maxPoints: 8,
    evaluate: (skill) => {
      const delegates = toArray(skill.collaborationYaml?.delegates_to);
      const receives = toArray(skill.collaborationYaml?.receives_from);
      const total = delegates.length + receives.length;
      if (total === 0) return { points: 0, reason: 'No collaboration rules - isolated skill' };
      if (total >= 4) return { points: 8, reason: `${total} collaboration rules` };
      return { points: total * 2, reason: `${total} collaboration rules` };
    }
  },
  {
    name: 'Delegates have conditions',
    maxPoints: 6,
    evaluate: (skill) => {
      const delegates = toArray(skill.collaborationYaml?.delegates_to);
      if (delegates.length === 0) return { points: 3, reason: 'No delegation rules (may be ok for leaf skill)' };
      const withWhen = delegates.filter((d: any) => d?.when && String(d.when).length > 10);
      const ratio = withWhen.length / delegates.length;
      return { 
        points: Math.round(ratio * 6), 
        reason: `${withWhen.length}/${delegates.length} delegates have conditions`
      };
    }
  },
  {
    name: 'Referential Integrity (Broken Links)',
    maxPoints: 5,
    evaluate: (skill, context) => {
      if (!context) return { points: 5, reason: 'Context missing (skipped check)' };
      
      const delegates = toArray(skill.collaborationYaml?.delegates_to);
      if (delegates.length === 0) return { points: 5, reason: 'No delegates to check' };

      const brokenLinks = delegates.filter((d: any) => d?.skill_id && !context.allSkillIds.has(d.skill_id));
      
      if (brokenLinks.length > 0) {
        return { 
          points: 0, 
          reason: `Broken links to: ${brokenLinks.map((d: any) => d.skill_id).join(', ')}` 
        };
      }
      
      return { points: 5, reason: 'All delegates exist' };
    }
  },
  {
    name: 'Has decisions.md',
    maxPoints: 3,
    evaluate: (skill) => {
      if (skill.hasDecisionsMd) return { points: 3, reason: 'Has decisions.md documentation' };
      return { points: 0, reason: 'No decisions.md' };
    }
  },
  {
    name: 'Has description',
    maxPoints: 3,
    evaluate: (skill) => {
      const desc = String(skill.skillYaml?.description || '');
      if (desc.length === 0) return { points: 0, reason: 'No description' };
      if (desc.length > 100) return { points: 3, reason: 'Good description' };
      return { points: 1, reason: 'Brief description' };
    }
  },
];

function evaluateCategory(skill: ParsedSkill, criteria: ScoringCriteria[], context?: ScoringContext): { score: number; gaps: string[]; strengths: string[] } {
  let score = 0;
  const gaps: string[] = [];
  const strengths: string[] = [];

  for (const criterion of criteria) {
    const result = criterion.evaluate(skill, context);
    score += result.points;
    
    if (result.points === 0) {
      gaps.push(`${criterion.name}: ${result.reason}`);
    } else if (result.points >= criterion.maxPoints * 0.8) {
      strengths.push(`${criterion.name}: ${result.reason}`);
    }
  }

  return { score, gaps, strengths };
}

export function scoreSkill(skill: ParsedSkill, context?: ScoringContext): ScoredSkill {
  try {
    const identity = evaluateCategory(skill, identityCriteria, context);
    const sharpEdges = evaluateCategory(skill, sharpEdgesCriteria, context);
    const validations = evaluateCategory(skill, validationsCriteria, context);
    const collaboration = evaluateCategory(skill, collaborationCriteria, context);

    const total = identity.score + sharpEdges.score + validations.score + collaboration.score;
    const allGaps = [...identity.gaps, ...sharpEdges.gaps, ...validations.gaps, ...collaboration.gaps];
    const allStrengths = [...identity.strengths, ...sharpEdges.strengths, ...validations.strengths, ...collaboration.strengths];

    return {
      ...skill,
      score: {
        total,
        breakdown: {
          identity: identity.score,
          sharpEdges: sharpEdges.score,
          validations: validations.score,
          collaboration: collaboration.score,
        },
        gaps: allGaps.slice(0, 5),
        strengths: allStrengths.slice(0, 5),
      },
    };
  } catch (error) {
    // If scoring fails, return minimal score
    console.error(`Warning: Failed to score skill ${skill.id}:`, error);
    return {
      ...skill,
      score: {
        total: 0,
        breakdown: { identity: 0, sharpEdges: 0, validations: 0, collaboration: 0 },
        gaps: ['Scoring failed'],
        strengths: [],
      },
    };
  }
}

export function scoreAllSkills(skills: ParsedSkill[]): ScoredSkill[] {
  // Create context with all skill IDs
  const context: ScoringContext = {
    allSkillIds: new Set(skills.map(s => s.id))
  };

  return skills.map(s => scoreSkill(s, context)).sort((a, b) => b.score.total - a.score.total);
}

export function getTier(score: number): 'excellent' | 'good' | 'mediocre' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'mediocre';
  return 'poor';
}