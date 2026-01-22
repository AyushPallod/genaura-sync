// Safely convert any value to an array
function toArray(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    if (typeof value === 'object')
        return Object.values(value);
    return [];
}
// Identity scoring (0-25 points)
const identityCriteria = [
    {
        name: 'Has defined role',
        maxPoints: 5,
        evaluate: (skill) => {
            const role = skill.skillYaml?.identity?.role;
            if (!role)
                return { points: 0, reason: 'No role defined' };
            if (String(role).length > 50)
                return { points: 5, reason: 'Clear, detailed role' };
            return { points: 3, reason: 'Basic role defined' };
        }
    },
    {
        name: 'Has expertise areas',
        maxPoints: 5,
        evaluate: (skill) => {
            const expertise = toArray(skill.skillYaml?.identity?.expertise);
            if (expertise.length === 0)
                return { points: 0, reason: 'No expertise listed' };
            if (expertise.length >= 5)
                return { points: 5, reason: `${expertise.length} expertise areas` };
            return { points: expertise.length, reason: `${expertise.length} expertise areas` };
        }
    },
    {
        name: 'Has guiding principles',
        maxPoints: 5,
        evaluate: (skill) => {
            const principles = toArray(skill.skillYaml?.identity?.principles);
            if (principles.length === 0)
                return { points: 0, reason: 'No principles defined' };
            if (principles.length >= 3)
                return { points: 5, reason: `${principles.length} principles` };
            return { points: principles.length * 2, reason: `${principles.length} principles` };
        }
    },
    {
        name: 'Has triggers',
        maxPoints: 5,
        evaluate: (skill) => {
            const triggers = toArray(skill.skillYaml?.triggers);
            if (triggers.length === 0)
                return { points: 0, reason: 'No triggers - how do users invoke this?' };
            if (triggers.length >= 5)
                return { points: 5, reason: `${triggers.length} activation triggers` };
            return { points: triggers.length, reason: `${triggers.length} triggers` };
        }
    },
    {
        name: 'Has ownership domains',
        maxPoints: 5,
        evaluate: (skill) => {
            const owns = toArray(skill.skillYaml?.owns);
            if (owns.length === 0)
                return { points: 0, reason: 'No ownership defined - unclear scope' };
            if (owns.length >= 3)
                return { points: 5, reason: `Owns ${owns.length} domains` };
            return { points: owns.length * 2, reason: `Owns ${owns.length} domains` };
        }
    },
];
// Sharp edges scoring (0-25 points)
const sharpEdgesCriteria = [
    {
        name: 'Has sharp-edges.yaml',
        maxPoints: 8,
        evaluate: (skill) => {
            const edgeList = toArray(skill.sharpEdgesYaml?.edges);
            if (edgeList.length === 0)
                return { points: 0, reason: 'No sharp edges defined' };
            if (edgeList.length >= 5)
                return { points: 8, reason: `${edgeList.length} pitfalls documented` };
            return { points: Math.min(edgeList.length * 2, 8), reason: `${edgeList.length} pitfalls` };
        }
    },
    {
        name: 'Edges have detection patterns',
        maxPoints: 8,
        evaluate: (skill) => {
            const edgeList = toArray(skill.sharpEdgesYaml?.edges);
            if (edgeList.length === 0)
                return { points: 0, reason: 'No edges to evaluate' };
            const withDetection = edgeList.filter((e) => e?.detection && String(e.detection).length > 10);
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
            if (edgeList.length === 0)
                return { points: 0, reason: 'No edges to evaluate' };
            const withSolution = edgeList.filter((e) => e?.solution && String(e.solution).length > 20);
            const ratio = withSolution.length / edgeList.length;
            return {
                points: Math.round(ratio * 5),
                reason: `${withSolution.length}/${edgeList.length} edges have solutions`
            };
        }
    },
    {
        name: 'Has sharp-edges.md deep dive',
        maxPoints: 4,
        evaluate: (skill) => {
            if (skill.hasSharpEdgesMd)
                return { points: 4, reason: 'Has detailed sharp-edges.md' };
            return { points: 0, reason: 'No sharp-edges.md documentation' };
        }
    },
];
// Validations scoring (0-25 points)
const validationsCriteria = [
    {
        name: 'Has validations.yaml',
        maxPoints: 10,
        evaluate: (skill) => {
            const validationList = toArray(skill.validationsYaml?.validations);
            if (validationList.length === 0)
                return { points: 0, reason: 'No validations - no quality checks' };
            if (validationList.length >= 5)
                return { points: 10, reason: `${validationList.length} validations` };
            return { points: validationList.length * 2, reason: `${validationList.length} validations` };
        }
    },
    {
        name: 'Validations have patterns',
        maxPoints: 8,
        evaluate: (skill) => {
            const validationList = toArray(skill.validationsYaml?.validations);
            if (validationList.length === 0)
                return { points: 0, reason: 'No validations' };
            const withPattern = validationList.filter((v) => v?.pattern && String(v.pattern).length > 5);
            const ratio = withPattern.length / validationList.length;
            return {
                points: Math.round(ratio * 8),
                reason: `${withPattern.length}/${validationList.length} have detection patterns`
            };
        }
    },
    {
        name: 'Has patterns.md',
        maxPoints: 4,
        evaluate: (skill) => {
            if (skill.hasPatternsMd)
                return { points: 4, reason: 'Has detailed patterns.md' };
            return { points: 0, reason: 'No patterns.md documentation' };
        }
    },
    {
        name: 'Has anti-patterns.md',
        maxPoints: 3,
        evaluate: (skill) => {
            if (skill.hasAntiPatternsMd)
                return { points: 3, reason: 'Has anti-patterns.md' };
            return { points: 0, reason: 'No anti-patterns.md' };
        }
    },
];
// Collaboration scoring (0-25 points)
const collaborationCriteria = [
    {
        name: 'Has collaboration.yaml',
        maxPoints: 8,
        evaluate: (skill) => {
            const delegates = toArray(skill.collaborationYaml?.delegates_to);
            const receives = toArray(skill.collaborationYaml?.receives_from);
            const total = delegates.length + receives.length;
            if (total === 0)
                return { points: 0, reason: 'No collaboration rules - isolated skill' };
            if (total >= 4)
                return { points: 8, reason: `${total} collaboration rules` };
            return { points: total * 2, reason: `${total} collaboration rules` };
        }
    },
    {
        name: 'Delegates have conditions',
        maxPoints: 6,
        evaluate: (skill) => {
            const delegates = toArray(skill.collaborationYaml?.delegates_to);
            if (delegates.length === 0)
                return { points: 3, reason: 'No delegation rules (may be ok for leaf skill)' };
            const withWhen = delegates.filter((d) => d?.when && String(d.when).length > 10);
            const ratio = withWhen.length / delegates.length;
            return {
                points: Math.round(ratio * 6),
                reason: `${withWhen.length}/${delegates.length} delegates have conditions`
            };
        }
    },
    {
        name: 'Has pairs_with defined',
        maxPoints: 5,
        evaluate: (skill) => {
            const pairs = toArray(skill.skillYaml?.pairs_with);
            if (pairs.length === 0)
                return { points: 0, reason: 'No compatible skills listed' };
            if (pairs.length >= 3)
                return { points: 5, reason: `Works with ${pairs.length} skills` };
            return { points: pairs.length * 2, reason: `Works with ${pairs.length} skills` };
        }
    },
    {
        name: 'Has decisions.md',
        maxPoints: 3,
        evaluate: (skill) => {
            if (skill.hasDecisionsMd)
                return { points: 3, reason: 'Has decisions.md documentation' };
            return { points: 0, reason: 'No decisions.md' };
        }
    },
    {
        name: 'Has description',
        maxPoints: 3,
        evaluate: (skill) => {
            const desc = String(skill.skillYaml?.description || '');
            if (desc.length === 0)
                return { points: 0, reason: 'No description' };
            if (desc.length > 100)
                return { points: 3, reason: 'Good description' };
            return { points: 1, reason: 'Brief description' };
        }
    },
];
function evaluateCategory(skill, criteria) {
    let score = 0;
    const gaps = [];
    const strengths = [];
    for (const criterion of criteria) {
        const result = criterion.evaluate(skill);
        score += result.points;
        if (result.points === 0) {
            gaps.push(`${criterion.name}: ${result.reason}`);
        }
        else if (result.points >= criterion.maxPoints * 0.8) {
            strengths.push(`${criterion.name}: ${result.reason}`);
        }
    }
    return { score, gaps, strengths };
}
export function scoreSkill(skill) {
    try {
        const identity = evaluateCategory(skill, identityCriteria);
        const sharpEdges = evaluateCategory(skill, sharpEdgesCriteria);
        const validations = evaluateCategory(skill, validationsCriteria);
        const collaboration = evaluateCategory(skill, collaborationCriteria);
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
    }
    catch (error) {
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
export function scoreAllSkills(skills) {
    return skills.map(scoreSkill).sort((a, b) => b.score.total - a.score.total);
}
export function getTier(score) {
    if (score >= 80)
        return 'excellent';
    if (score >= 60)
        return 'good';
    if (score >= 40)
        return 'mediocre';
    return 'poor';
}
