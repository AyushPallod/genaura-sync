import { existsSync, mkdirSync, readdirSync, statSync, symlinkSync, unlinkSync, cpSync, readlinkSync, rmSync } from 'fs';
import { join, basename } from 'path';
import type { ScoredSkill } from './types.js';

export interface SyncTarget {
  name: string;
  path: string;
  exists: boolean;
}

export interface SyncResult {
  target: string;
  linked: number;
  skipped: number;
  updated: number;
  errors: string[];
}

export interface BackupResult {
  target: string;
  path: string;
  count: number;
}

export interface BackupEntry {
  timestamp: string;
  path: string;
  targets: string[];
}

const TARGET_CONFIGS = [
  { name: 'claude', path: '.claude/skills' },
  { name: 'cursor', path: '.cursor/skills' },
  { name: 'codex', path: '.codex/skills' },
  { name: 'copilot', path: '.github-copilot/skills' },
  { name: 'gemini', path: '.gemini/skills' },
  { name: 'opencode', path: '.opencode/skills' },
  { name: 'antigravity', path: '.antigravity/skills' },
  { name: 'windsurf', path: '.windsurf/skills' },
];

export function getTargets(): SyncTarget[] {
  const home = process.env.HOME || '~';
  
  return TARGET_CONFIGS.map(config => {
    const fullPath = join(home, config.path);
    return {
      name: config.name,
      path: fullPath,
      exists: existsSync(fullPath),
    };
  });
}

export function getSourcePath(): string {
  const home = process.env.HOME || '~';
  // Default source is genaura-sync config or spawner
  const genauraSyncPath = join(home, '.config', 'genaura-sync', 'skills');
  const spawnerPath = join(home, '.spawner', 'skills');
  
  if (existsSync(genauraSyncPath)) return genauraSyncPath;
  if (existsSync(spawnerPath)) return spawnerPath;
  
  return spawnerPath; // Default
}

export function getBackupBaseDir(): string {
  const home = process.env.HOME || '~';
  return join(home, '.config', 'genaura-sync', 'backups');
}

export function getBackupDir(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return join(getBackupBaseDir(), timestamp);
}

export function listBackups(): BackupEntry[] {
  const backupBase = getBackupBaseDir();
  
  if (!existsSync(backupBase)) {
    return [];
  }

  try {
    const entries = readdirSync(backupBase);
    const backups: BackupEntry[] = [];

    for (const entry of entries) {
      const backupPath = join(backupBase, entry);
      const stat = statSync(backupPath);
      
      if (stat.isDirectory()) {
        const targets = readdirSync(backupPath).filter(t => {
          try {
            return statSync(join(backupPath, t)).isDirectory();
          } catch {
            return false;
          }
        });

        backups.push({
          timestamp: entry,
          path: backupPath,
          targets,
        });
      }
    }

    // Sort newest first
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

export function restoreBackup(backupPath: string, targetName?: string): { success: boolean; restored: string[]; errors: string[] } {
  const result = { success: true, restored: [] as string[], errors: [] as string[] };

  if (!existsSync(backupPath)) {
    result.success = false;
    result.errors.push('Backup not found');
    return result;
  }

  const targets = getTargets();
  const backupTargets = readdirSync(backupPath).filter(t => {
    try {
      return statSync(join(backupPath, t)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const bt of backupTargets) {
    // Skip if specific target requested and this isn't it
    if (targetName && bt !== targetName) {
      continue;
    }

    const target = targets.find(t => t.name === bt);
    if (!target) {
      result.errors.push(`Unknown target: ${bt}`);
      continue;
    }

    const backupTargetPath = join(backupPath, bt);
    
    try {
      // Remove current target contents
      if (existsSync(target.path)) {
        const entries = readdirSync(target.path);
        for (const entry of entries) {
          const entryPath = join(target.path, entry);
          try {
            rmSync(entryPath, { recursive: true, force: true });
          } catch {}
        }
      } else {
        mkdirSync(target.path, { recursive: true });
      }

      // Copy backup contents
      const backupEntries = readdirSync(backupTargetPath);
      for (const entry of backupEntries) {
        const src = join(backupTargetPath, entry);
        const dest = join(target.path, entry);
        cpSync(src, dest, { recursive: true });
      }

      result.restored.push(bt);
    } catch (error) {
      result.success = false;
      result.errors.push(`${bt}: ${error instanceof Error ? error.message : 'restore failed'}`);
    }
  }

  return result;
}

export function backupTarget(target: SyncTarget, backupDir: string): BackupResult | null {
  if (!target.exists) {
    return null;
  }

  try {
    const targetBackupDir = join(backupDir, target.name);
    mkdirSync(targetBackupDir, { recursive: true });

    let count = 0;
    const entries = readdirSync(target.path);
    
    for (const entry of entries) {
      const sourcePath = join(target.path, entry);
      const destPath = join(targetBackupDir, entry);
      
      try {
        const stat = statSync(sourcePath);
        if (stat.isDirectory()) {
          cpSync(sourcePath, destPath, { recursive: true });
          count++;
        }
      } catch {
        // Skip files we can't backup
      }
    }

    return {
      target: target.name,
      path: targetBackupDir,
      count,
    };
  } catch {
    return null;
  }
}

export function syncSkillsToTarget(
  skills: ScoredSkill[],
  target: SyncTarget,
  options: { minScore?: number; dryRun?: boolean } = {}
): SyncResult {
  const result: SyncResult = {
    target: target.name,
    linked: 0,
    skipped: 0,
    updated: 0,
    errors: [],
  };

  const minScore = options.minScore ?? 0; // Default: sync all

  // Ensure target directory exists
  if (!options.dryRun) {
    mkdirSync(target.path, { recursive: true });
  }

  for (const skill of skills) {
    // Skip low quality skills if threshold set
    if (skill.score.total < minScore) {
      result.skipped++;
      continue;
    }

    const linkPath = join(target.path, skill.id);
    const sourcePath = skill.path;

    try {
      // Check if link already exists
      if (existsSync(linkPath)) {
        try {
          const existingTarget = readlinkSync(linkPath);
          if (existingTarget === sourcePath) {
            // Already correctly linked
            result.linked++;
            continue;
          }
          // Different target, update it
          if (!options.dryRun) {
            unlinkSync(linkPath);
          }
          result.updated++;
        } catch {
          // Not a symlink, it's a real directory - skip to avoid data loss
          result.errors.push(`${skill.id}: target exists as directory, skipped`);
          continue;
        }
      }

      // Create symlink
      if (!options.dryRun) {
        symlinkSync(sourcePath, linkPath);
      }
      result.linked++;

    } catch (error) {
      result.errors.push(`${skill.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return result;
}

export function getExistingSkillsInTarget(target: SyncTarget): string[] {
  if (!target.exists) return [];
  
  try {
    return readdirSync(target.path).filter(entry => {
      const fullPath = join(target.path, entry);
      try {
        const stat = statSync(fullPath);
        return stat.isDirectory() || statSync(fullPath).isSymbolicLink;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Pull skills from a target back to source
 * Only pulls non-symlinked directories (actual local skills)
 */
export function pullFromTarget(
  target: SyncTarget,
  sourcePath: string,
  options: { force?: boolean } = {}
): { pulled: string[]; skipped: string[]; errors: string[] } {
  const result = { pulled: [] as string[], skipped: [] as string[], errors: [] as string[] };

  if (!target.exists) {
    result.errors.push('Target does not exist');
    return result;
  }

  mkdirSync(sourcePath, { recursive: true });

  try {
    const entries = readdirSync(target.path);

    for (const entry of entries) {
      const targetSkillPath = join(target.path, entry);
      const sourceSkillPath = join(sourcePath, entry);

      try {
        // Check if it's a symlink
        readlinkSync(targetSkillPath);
        // It's a symlink, skip it (it's already from source)
        result.skipped.push(entry);
        continue;
      } catch {
        // Not a symlink, it's a real directory - pull it
      }

      try {
        const stat = statSync(targetSkillPath);
        if (!stat.isDirectory()) {
          continue;
        }

        // Check if exists in source
        if (existsSync(sourceSkillPath) && !options.force) {
          result.skipped.push(entry);
          continue;
        }

        // Copy to source
        if (existsSync(sourceSkillPath)) {
          rmSync(sourceSkillPath, { recursive: true, force: true });
        }
        cpSync(targetSkillPath, sourceSkillPath, { recursive: true });
        result.pulled.push(entry);
      } catch (error) {
        result.errors.push(`${entry}: ${error instanceof Error ? error.message : 'failed'}`);
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'failed to read target');
  }

  return result;
}
