#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scanSkills, getDefaultPaths } from './scanner.js';
import { scoreAllSkills, getTier } from './scorer.js';
import { analyzeOverlaps } from './detector.js';
import { getTargets, getSourcePath, getBackupDir, backupTarget, syncSkillsToTarget } from './syncer.js';
// Genaura brand colors
const brand = {
    purple: chalk.hex('#8b5cf6'),
    cyan: chalk.hex('#22d3ee'),
    dim: chalk.dim,
};
const LOGO = `
${brand.purple('╔═══════════════════════════════════════╗')}
${brand.purple('║')}  ${brand.cyan('⚡')} ${brand.purple.bold('GENAURA SYNC')}                      ${brand.purple('║')}
${brand.purple('║')}  ${brand.dim('Rate skills. Use the best.')}           ${brand.purple('║')}
${brand.purple('╚═══════════════════════════════════════╝')}
`;
const program = new Command();
program
    .name('genaura-sync')
    .description('Rate and sync AI skills - find the best, skip the garbage')
    .version('1.0.0');
// RATE command - main command
program
    .command('rate')
    .description('Scan and rate all skills')
    .option('-p, --path <paths...>', 'Custom paths to scan')
    .option('-v, --verbose', 'Show detailed breakdown')
    .option('--json', 'Output as JSON')
    .option('-q, --quiet', 'Skip logo')
    .action(async (options) => {
    if (!options.quiet && !options.json) {
        console.log(LOGO);
    }
    const spinner = ora({ text: 'Scanning skills...', color: 'magenta' }).start();
    try {
        const skills = await scanSkills({ paths: options.path });
        spinner.text = `Found ${skills.length} skills. Scoring...`;
        const scoredSkills = scoreAllSkills(skills);
        spinner.text = 'Analyzing overlaps...';
        const { overlaps, contradictions } = analyzeOverlaps(scoredSkills);
        spinner.succeed(brand.purple(`Rated ${scoredSkills.length} skills`));
        if (options.json) {
            const report = {
                timestamp: new Date().toISOString(),
                totalSkills: scoredSkills.length,
                averageScore: Math.round(scoredSkills.reduce((sum, s) => sum + s.score.total, 0) / scoredSkills.length),
                tiers: {
                    excellent: scoredSkills.filter(s => getTier(s.score.total) === 'excellent'),
                    good: scoredSkills.filter(s => getTier(s.score.total) === 'good'),
                    mediocre: scoredSkills.filter(s => getTier(s.score.total) === 'mediocre'),
                    poor: scoredSkills.filter(s => getTier(s.score.total) === 'poor'),
                },
                overlaps,
                contradictions,
            };
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log('');
        printTierSummary(scoredSkills);
        if (options.verbose) {
            console.log('');
            printDetailedScores(scoredSkills);
        }
        if (overlaps.length > 0) {
            console.log('');
            printOverlaps(overlaps);
        }
        if (contradictions.length > 0) {
            console.log('');
            printContradictions(contradictions);
        }
    }
    catch (error) {
        spinner.fail('Failed to rate skills');
        console.error(error);
        process.exit(1);
    }
});
// COMPARE command
program
    .command('compare <skills...>')
    .description('Compare specific skills side-by-side')
    .action(async (skillIds) => {
    console.log(LOGO);
    const spinner = ora({ text: 'Loading skills...', color: 'magenta' }).start();
    try {
        const allSkills = await scanSkills();
        const scoredSkills = scoreAllSkills(allSkills);
        const selected = scoredSkills.filter(s => skillIds.some((id) => s.id.toLowerCase().includes(id.toLowerCase())));
        if (selected.length === 0) {
            spinner.fail('No matching skills found');
            console.log('\nAvailable skills:');
            scoredSkills.slice(0, 10).forEach(s => console.log(`  ${brand.dim('-')} ${s.id}`));
            return;
        }
        spinner.succeed(brand.purple(`Comparing ${selected.length} skills`));
        console.log('');
        printComparison(selected);
    }
    catch (error) {
        spinner.fail('Failed to compare skills');
        console.error(error);
        process.exit(1);
    }
});
// BEST command
program
    .command('best <query>')
    .description('Find the best skill for a use case')
    .action(async (query) => {
    console.log(LOGO);
    const spinner = ora({ text: `Finding best skill for "${query}"...`, color: 'magenta' }).start();
    try {
        const allSkills = await scanSkills();
        const scoredSkills = scoreAllSkills(allSkills);
        const toArr = (v) => {
            if (!v)
                return [];
            if (Array.isArray(v))
                return v.filter(x => typeof x === 'string');
            return [];
        };
        const matches = scoredSkills.filter(s => {
            const searchText = [
                s.id,
                s.name,
                String(s.skillYaml?.description || ''),
                ...toArr(s.skillYaml?.triggers),
                ...toArr(s.skillYaml?.owns),
                ...toArr(s.skillYaml?.tags),
            ].join(' ').toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
        if (matches.length === 0) {
            spinner.fail('No skills match that query');
            return;
        }
        spinner.succeed(brand.purple(`Found ${matches.length} matching skills`));
        console.log('');
        const best = matches[0];
        console.log(brand.cyan(`  ⚡ Best: ${best.name}`));
        console.log(brand.dim(`     ID: ${best.id}`));
        console.log(brand.dim(`     Score: ${colorScore(best.score.total)}/100`));
        console.log(brand.dim(`     ${best.skillYaml?.description || 'No description'}`));
        if (matches.length > 1) {
            console.log('');
            console.log(brand.purple('  Alternatives:'));
            matches.slice(1, 4).forEach((s, i) => {
                console.log(brand.dim(`     ${i + 2}. ${s.name} (${colorScore(s.score.total)}/100)`));
            });
        }
    }
    catch (error) {
        spinner.fail('Failed to search skills');
        console.error(error);
        process.exit(1);
    }
});
// STATUS command
program
    .command('status')
    .description('Show configured skill paths and counts')
    .action(async () => {
    console.log(LOGO);
    const paths = getDefaultPaths();
    console.log(brand.purple.bold('  Skill Paths:\n'));
    if (paths.length === 0) {
        console.log(chalk.yellow('  No skill directories found'));
        console.log(brand.dim('  Expected locations:'));
        console.log(brand.dim('    ~/.spawner/skills/'));
        console.log(brand.dim('    ~/.claude/skills/'));
        console.log(brand.dim('    ~/.cursor/skills/'));
        return;
    }
    for (const path of paths) {
        const skills = await scanSkills({ paths: [path] });
        const icon = skills.length > 0 ? brand.cyan('✓') : brand.dim('○');
        const count = skills.length > 0 ? brand.purple(`${skills.length} skills`) : brand.dim('empty');
        console.log(`  ${icon} ${brand.dim(path)} (${count})`);
    }
});
// CLEAN command - remove poor skills
program
    .command('clean')
    .description('List skills that should be removed (score < 40)')
    .option('--dry-run', 'Just show what would be cleaned')
    .action(async (options) => {
    console.log(LOGO);
    const spinner = ora({ text: 'Analyzing skills...', color: 'magenta' }).start();
    try {
        const allSkills = await scanSkills();
        const scoredSkills = scoreAllSkills(allSkills);
        const poor = scoredSkills.filter(s => getTier(s.score.total) === 'poor');
        if (poor.length === 0) {
            spinner.succeed(brand.cyan('No garbage skills found - nice!'));
            return;
        }
        spinner.succeed(brand.purple(`Found ${poor.length} skills to clean`));
        console.log('');
        poor.forEach(s => {
            console.log(`  ${chalk.red('✗')} ${s.name} ${brand.dim(`(${s.score.total}/100)`)}`);
            console.log(brand.dim(`    ${s.path}`));
            if (s.score.gaps.length > 0) {
                console.log(brand.dim(`    Missing: ${s.score.gaps[0]}`));
            }
            console.log('');
        });
        console.log(brand.dim('  Run with paths to remove:'));
        poor.forEach(s => {
            console.log(brand.dim(`    rm -rf "${s.path}"`));
        });
    }
    catch (error) {
        spinner.fail('Failed to analyze skills');
        console.error(error);
        process.exit(1);
    }
});
// SYNC command - the main event: rate then sync
program
    .command('sync')
    .description('Rate skills, then sync to all AI tools (claude, cursor, codex, etc.)')
    .option('--min-score <score>', 'Only sync skills above this score (default: 0)', '0')
    .option('--no-backup', 'Skip backup before syncing')
    .option('--dry-run', 'Show what would happen without syncing')
    .option('-p, --path <path>', 'Custom source path')
    .action(async (options) => {
    console.log(LOGO);
    const minScore = parseInt(options.minScore) || 0;
    const targets = getTargets();
    const activeTargets = targets.filter(t => t.exists);
    // Step 1: Rate skills
    const spinner = ora({ text: 'Rating skills...', color: 'magenta' }).start();
    try {
        const sourcePath = options.path || getSourcePath();
        const skills = await scanSkills({ paths: [sourcePath] });
        if (skills.length === 0) {
            spinner.fail('No skills found in source');
            console.log(brand.dim(`  Source: ${sourcePath}`));
            return;
        }
        const scoredSkills = scoreAllSkills(skills);
        const qualifiedSkills = minScore > 0
            ? scoredSkills.filter(s => s.score.total >= minScore)
            : scoredSkills;
        const skippedCount = scoredSkills.length - qualifiedSkills.length;
        spinner.succeed(brand.purple(`Rated ${scoredSkills.length} skills`));
        // Show quick tier summary
        const tiers = {
            excellent: scoredSkills.filter(s => getTier(s.score.total) === 'excellent').length,
            good: scoredSkills.filter(s => getTier(s.score.total) === 'good').length,
            mediocre: scoredSkills.filter(s => getTier(s.score.total) === 'mediocre').length,
            poor: scoredSkills.filter(s => getTier(s.score.total) === 'poor').length,
        };
        console.log('');
        console.log(brand.purple('  Quality Summary'));
        console.log(brand.dim('  ─────────────────────────────────────────'));
        console.log(`  ${brand.cyan('⚡')} Excellent: ${tiers.excellent}  ${brand.purple('✓')} Good: ${tiers.good}  ${chalk.yellow('○')} Mediocre: ${tiers.mediocre}  ${chalk.red('✗')} Poor: ${tiers.poor}`);
        if (minScore > 0) {
            console.log(brand.dim(`  Syncing ${qualifiedSkills.length} skills (score ≥ ${minScore}), skipping ${skippedCount}`));
        }
        // Step 2: Backup
        if (options.backup !== false && activeTargets.length > 0 && !options.dryRun) {
            console.log('');
            console.log(brand.purple('  Backing up'));
            console.log(brand.dim('  ─────────────────────────────────────────'));
            const backupDir = getBackupDir();
            for (const target of activeTargets) {
                const result = backupTarget(target, backupDir);
                if (result && result.count > 0) {
                    console.log(`  ${brand.cyan('✓')} ${target.name} → ${brand.dim(result.path)}`);
                }
            }
        }
        // Step 3: Sync to all targets
        console.log('');
        console.log(brand.purple('  Syncing skills'));
        console.log(brand.dim('  ─────────────────────────────────────────'));
        for (const target of targets) {
            const result = syncSkillsToTarget(qualifiedSkills, target, {
                minScore,
                dryRun: options.dryRun
            });
            const status = result.errors.length > 0 ? chalk.yellow('!') : brand.cyan('✓');
            const dryLabel = options.dryRun ? brand.dim(' (dry-run)') : '';
            console.log(`  ${status} ${target.name}: ${brand.purple('synced')} (${result.linked} linked, ${result.skipped} skipped, ${result.updated} updated)${dryLabel}`);
            if (result.errors.length > 0) {
                result.errors.slice(0, 3).forEach(err => {
                    console.log(brand.dim(`      ${err}`));
                });
            }
        }
        console.log('');
        if (options.dryRun) {
            console.log(brand.cyan('  ⚡ Dry run complete. Run without --dry-run to sync.'));
        }
        else {
            console.log(brand.cyan('  ⚡ Sync complete!'));
        }
    }
    catch (error) {
        spinner.fail('Sync failed');
        console.error(error);
        process.exit(1);
    }
});
// TARGETS command - show sync targets
program
    .command('targets')
    .description('Show available sync targets')
    .action(async () => {
    console.log(LOGO);
    const targets = getTargets();
    const source = getSourcePath();
    console.log(brand.purple.bold('  Source:\n'));
    console.log(`  ${brand.cyan('⚡')} ${source}`);
    console.log('');
    console.log(brand.purple.bold('  Sync Targets:\n'));
    for (const target of targets) {
        const icon = target.exists ? brand.cyan('✓') : brand.dim('○');
        const status = target.exists ? brand.purple('active') : brand.dim('not found');
        console.log(`  ${icon} ${target.name.padEnd(12)} ${brand.dim(target.path)} (${status})`);
    }
    console.log('');
    console.log(brand.dim('  Run `gsync sync` to sync rated skills to all targets'));
});
// Helper functions
function colorScore(score) {
    if (score >= 80)
        return brand.cyan.bold(score.toString());
    if (score >= 60)
        return brand.purple(score.toString());
    if (score >= 40)
        return chalk.yellow(score.toString());
    return chalk.red(score.toString());
}
function tierEmoji(tier) {
    switch (tier) {
        case 'excellent': return '⚡';
        case 'good': return '✓';
        case 'mediocre': return '○';
        case 'poor': return '✗';
        default: return '•';
    }
}
function printTierSummary(skills) {
    const tiers = {
        excellent: skills.filter(s => getTier(s.score.total) === 'excellent'),
        good: skills.filter(s => getTier(s.score.total) === 'good'),
        mediocre: skills.filter(s => getTier(s.score.total) === 'mediocre'),
        poor: skills.filter(s => getTier(s.score.total) === 'poor'),
    };
    console.log(brand.purple.bold('  Quality Tiers:\n'));
    if (tiers.excellent.length > 0) {
        console.log(brand.cyan(`  ${tierEmoji('excellent')} Excellent (80-100): ${tiers.excellent.length} skills`));
        tiers.excellent.slice(0, 5).forEach(s => {
            console.log(`     ${colorScore(s.score.total)} ${s.name}`);
        });
        console.log('');
    }
    if (tiers.good.length > 0) {
        console.log(brand.purple(`  ${tierEmoji('good')} Good (60-79): ${tiers.good.length} skills`));
        tiers.good.slice(0, 5).forEach(s => {
            console.log(`     ${colorScore(s.score.total)} ${s.name}`);
        });
        console.log('');
    }
    if (tiers.mediocre.length > 0) {
        console.log(chalk.yellow(`  ${tierEmoji('mediocre')} Mediocre (40-59): ${tiers.mediocre.length} skills`));
        tiers.mediocre.slice(0, 3).forEach(s => {
            console.log(`     ${colorScore(s.score.total)} ${s.name}`);
        });
        console.log('');
    }
    if (tiers.poor.length > 0) {
        console.log(chalk.red(`  ${tierEmoji('poor')} Poor (0-39): ${tiers.poor.length} skills - run 'genaura-sync clean'`));
        tiers.poor.slice(0, 3).forEach(s => {
            console.log(`     ${colorScore(s.score.total)} ${s.name}`);
        });
    }
}
function printDetailedScores(skills) {
    console.log(brand.purple.bold('  Detailed Scores:\n'));
    console.log(brand.dim('  Skill                          Total  Identity  Edges  Valid  Collab'));
    console.log(brand.dim('  ' + '─'.repeat(72)));
    skills.slice(0, 20).forEach(s => {
        const name = s.name.slice(0, 30).padEnd(30);
        const b = s.score.breakdown;
        console.log(`  ${name} ${colorScore(s.score.total).padStart(5)}  ${String(b.identity).padStart(8)}  ${String(b.sharpEdges).padStart(5)}  ${String(b.validations).padStart(5)}  ${String(b.collaboration).padStart(6)}`);
    });
}
function printOverlaps(overlaps) {
    console.log(brand.purple.bold('  ⚠️  Overlapping Skills:\n'));
    overlaps.slice(0, 5).forEach(overlap => {
        console.log(chalk.yellow(`  Domain: ${overlap.domain}`));
        console.log(brand.cyan(`  ⚡ Use: ${overlap.recommendation.best.name} (${overlap.recommendation.best.score.total}/100)`));
        console.log(brand.dim(`     ${overlap.recommendation.reason}`));
        overlap.recommendation.alternatives.slice(0, 2).forEach((alt) => {
            console.log(brand.dim(`  ○ Skip: ${alt.skill.name} (${alt.skill.score.total}/100) - ${alt.useCase}`));
        });
        console.log('');
    });
}
function printContradictions(contradictions) {
    console.log(chalk.red.bold('  ❌ Contradictions:\n'));
    contradictions.slice(0, 5).forEach(c => {
        console.log(chalk.red(`  ${c.skillA} ↔ ${c.skillB}`));
        console.log(brand.dim(`     Conflict: ${c.conflict}`));
        console.log(brand.cyan(`     Fix: ${c.resolution}`));
        console.log('');
    });
}
function printComparison(skills) {
    console.log(brand.purple.bold('  Side-by-Side:\n'));
    const headers = ['Metric', ...skills.map(s => s.name.slice(0, 15))];
    console.log('  ' + headers.map(h => h.padEnd(18)).join(''));
    console.log(brand.dim('  ' + '─'.repeat(18 * headers.length)));
    const totals = ['Total Score', ...skills.map(s => colorScore(s.score.total) + '/100')];
    console.log('  ' + totals.map(t => String(t).padEnd(18)).join(''));
    const categories = ['Identity', 'Sharp Edges', 'Validations', 'Collaboration'];
    const keys = ['identity', 'sharpEdges', 'validations', 'collaboration'];
    keys.forEach((key, i) => {
        const row = [categories[i], ...skills.map(s => `${s.score.breakdown[key]}/25`)];
        console.log(brand.dim('  ' + row.map(r => r.padEnd(18)).join('')));
    });
    console.log('');
    console.log(brand.cyan.bold(`  ⚡ Winner: ${skills[0].name} (${skills[0].score.total}/100)`));
}
program.parse();
