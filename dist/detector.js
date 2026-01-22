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
function findOverlaps(skills) {
    const triggerMap = new Map();
    const ownsMap = new Map();
    const tagMap = new Map();
    for (const skill of skills) {
        // Index triggers
        for (const trigger of toArray(skill.skillYaml?.triggers)) {
            if (typeof trigger !== 'string')
                continue;
            const normalized = trigger.toLowerCase().trim();
            if (!triggerMap.has(normalized))
                triggerMap.set(normalized, []);
            triggerMap.get(normalized).push(skill);
        }
        // Index owns
        for (const own of toArray(skill.skillYaml?.owns)) {
            if (typeof own !== 'string')
                continue;
            const normalized = own.toLowerCase().trim();
            if (!ownsMap.has(normalized))
                ownsMap.set(normalized, []);
            ownsMap.get(normalized).push(skill);
        }
        // Index tags
        for (const tag of toArray(skill.skillYaml?.tags)) {
            if (typeof tag !== 'string')
                continue;
            const normalized = tag.toLowerCase().trim();
            if (!tagMap.has(normalized))
                tagMap.set(normalized, []);
            tagMap.get(normalized).push(skill);
        }
    }
    const overlaps = [];
    // Find trigger overlaps (multiple skills respond to same trigger)
    for (const [trigger, matchedSkills] of triggerMap) {
        if (matchedSkills.length > 1) {
            overlaps.push({ type: 'trigger', value: trigger, skills: matchedSkills });
        }
    }
    // Find owns overlaps (multiple skills claim same domain)
    for (const [domain, matchedSkills] of ownsMap) {
        if (matchedSkills.length > 1) {
            overlaps.push({ type: 'owns', value: domain, skills: matchedSkills });
        }
    }
    // Find significant tag overlaps (3+ matching tags between skills)
    // This is less critical, so we aggregate differently
    return overlaps;
}
function groupOverlaps(overlaps) {
    // Group overlaps by the set of skills involved
    const groupMap = new Map();
    for (const overlap of overlaps) {
        // Create a key from sorted skill IDs
        const skillIds = overlap.skills.map(s => s.id).sort().join('|');
        if (!groupMap.has(skillIds)) {
            groupMap.set(skillIds, { domains: [], skills: overlap.skills });
        }
        groupMap.get(skillIds).domains.push(`${overlap.type}:${overlap.value}`);
    }
    const groups = [];
    for (const [_, group] of groupMap) {
        // Sort skills by score (best first)
        const sortedSkills = [...group.skills].sort((a, b) => b.score.total - a.score.total);
        const best = sortedSkills[0];
        const alternatives = sortedSkills.slice(1);
        groups.push({
            domain: group.domains.join(', '),
            skills: sortedSkills,
            recommendation: {
                best,
                reason: generateRecommendationReason(best, alternatives),
                alternatives: alternatives.map(skill => ({
                    skill,
                    useCase: generateAlternativeUseCase(skill, best),
                })),
            },
        });
    }
    return groups.sort((a, b) => b.skills.length - a.skills.length);
}
function generateRecommendationReason(best, alternatives) {
    const reasons = [];
    // Score advantage
    if (alternatives.length > 0) {
        const scoreDiff = best.score.total - alternatives[0].score.total;
        if (scoreDiff > 20) {
            reasons.push(`${scoreDiff} points higher quality score`);
        }
        else if (scoreDiff > 10) {
            reasons.push(`${scoreDiff} points better`);
        }
    }
    // Category strengths
    const breakdown = best.score.breakdown;
    if (breakdown.identity >= 20)
        reasons.push('strong identity definition');
    if (breakdown.sharpEdges >= 20)
        reasons.push('comprehensive pitfall coverage');
    if (breakdown.validations >= 20)
        reasons.push('robust validations');
    if (breakdown.collaboration >= 20)
        reasons.push('clear collaboration rules');
    if (reasons.length === 0) {
        return `Highest overall quality (${best.score.total}/100)`;
    }
    return reasons.slice(0, 2).join(', ');
}
function generateAlternativeUseCase(alt, best) {
    // Find where alternative might be better
    const altBreakdown = alt.score.breakdown;
    const bestBreakdown = best.score.breakdown;
    if (altBreakdown.sharpEdges > bestBreakdown.sharpEdges) {
        return 'Better pitfall documentation';
    }
    if (altBreakdown.validations > bestBreakdown.validations) {
        return 'More validation patterns';
    }
    if (altBreakdown.collaboration > bestBreakdown.collaboration) {
        return 'Better integration with other skills';
    }
    // Check for unique triggers or owns
    const altTriggers = alt.skillYaml?.triggers || [];
    const bestTriggers = best.skillYaml?.triggers || [];
    const uniqueTriggers = altTriggers.filter(t => !bestTriggers.includes(t));
    if (uniqueTriggers.length > 0) {
        return `Unique triggers: ${uniqueTriggers.slice(0, 2).join(', ')}`;
    }
    return `Lower quality (${alt.score.total}/100) - consider avoiding`;
}
function findContradictions(skills) {
    const contradictions = [];
    // Compare skills pairwise for conflicting patterns
    for (let i = 0; i < skills.length; i++) {
        for (let j = i + 1; j < skills.length; j++) {
            const skillA = skills[i];
            const skillB = skills[j];
            // Check if they claim to own the same domain but have different approaches
            const ownsA = skillA.skillYaml?.owns || [];
            const ownsB = skillB.skillYaml?.owns || [];
            const sharedOwns = ownsA.filter(o => ownsB.includes(o));
            if (sharedOwns.length > 0) {
                // Check for conflicting delegation rules
                const delegatesA = skillA.collaborationYaml?.delegates_to?.map(d => d.skill_id) || [];
                const delegatesB = skillB.collaborationYaml?.delegates_to?.map(d => d.skill_id) || [];
                // If A delegates to B but B also delegates to A, that's a loop
                if (delegatesA.includes(skillB.id) && delegatesB.includes(skillA.id)) {
                    contradictions.push({
                        skillA: skillA.id,
                        skillB: skillB.id,
                        conflict: `Circular delegation: ${skillA.id} → ${skillB.id} → ${skillA.id}`,
                        resolution: `Use skill with higher score: ${skillA.score.total > skillB.score.total ? skillA.id : skillB.id}`,
                    });
                }
                // If both claim to own the same domain with high confidence
                if (sharedOwns.length >= 2) {
                    const better = skillA.score.total > skillB.score.total ? skillA : skillB;
                    const worse = skillA.score.total > skillB.score.total ? skillB : skillA;
                    contradictions.push({
                        skillA: skillA.id,
                        skillB: skillB.id,
                        conflict: `Both claim ownership of: ${sharedOwns.join(', ')}`,
                        resolution: `Prefer ${better.id} (${better.score.total}/100) over ${worse.id} (${worse.score.total}/100)`,
                    });
                }
            }
        }
    }
    return contradictions;
}
export function analyzeOverlaps(skills) {
    const rawOverlaps = findOverlaps(skills);
    const groupedOverlaps = groupOverlaps(rawOverlaps);
    const contradictions = findContradictions(skills);
    return { overlaps: groupedOverlaps, contradictions };
}
