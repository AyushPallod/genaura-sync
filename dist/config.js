import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
const DEFAULT_CONFIG = {
    version: '1.0.0',
    source: '',
    minScore: 0,
    autoBackup: true,
    targets: [],
    remotes: [],
};
export function getConfigDir() {
    const home = process.env.HOME || '~';
    return join(home, '.config', 'genaura-sync');
}
export function getConfigPath() {
    return join(getConfigDir(), 'config.yaml');
}
export function configExists() {
    return existsSync(getConfigPath());
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
        return null;
    }
    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = parseYaml(content);
        return { ...DEFAULT_CONFIG, ...config };
    }
    catch {
        return null;
    }
}
export function saveConfig(config) {
    const configDir = getConfigDir();
    const configPath = getConfigPath();
    mkdirSync(configDir, { recursive: true });
    const content = stringifyYaml(config, { indent: 2 });
    writeFileSync(configPath, content, 'utf-8');
}
export function createDefaultConfig(detectedTargets, sourcePath) {
    return {
        ...DEFAULT_CONFIG,
        source: sourcePath,
        targets: detectedTargets.map(t => ({
            name: t.name,
            path: t.path,
            enabled: true,
        })),
    };
}
export function detectInstalledCLIs() {
    const home = process.env.HOME || '~';
    const clis = [
        { name: 'claude', path: join(home, '.claude'), skillsDir: 'skills' },
        { name: 'cursor', path: join(home, '.cursor'), skillsDir: 'skills' },
        { name: 'codex', path: join(home, '.codex'), skillsDir: 'skills' },
        { name: 'copilot', path: join(home, '.github-copilot'), skillsDir: 'skills' },
        { name: 'gemini', path: join(home, '.gemini'), skillsDir: 'skills' },
        { name: 'opencode', path: join(home, '.opencode'), skillsDir: 'skills' },
        { name: 'antigravity', path: join(home, '.antigravity'), skillsDir: 'skills' },
        { name: 'windsurf', path: join(home, '.windsurf'), skillsDir: 'skills' },
    ];
    return clis.map(cli => ({
        name: cli.name,
        path: join(cli.path, cli.skillsDir),
        exists: existsSync(cli.path),
    }));
}
export function detectSourcePath() {
    const home = process.env.HOME || '~';
    const sources = [
        join(home, '.config', 'genaura-sync', 'skills'),
        join(home, '.spawner', 'skills'),
    ];
    for (const source of sources) {
        if (existsSync(source)) {
            return source;
        }
    }
    // Default to genaura-sync location
    return join(home, '.config', 'genaura-sync', 'skills');
}
