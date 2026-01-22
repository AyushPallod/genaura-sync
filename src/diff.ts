import { existsSync, readFileSync, readdirSync, statSync, readlinkSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { getConfigDir } from './config.js';

export interface SkillSnapshot {
  id: string;
  hash: string;
  files: { name: string; hash: string }[];
  timestamp: string;
}

export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

export interface TargetDiff {
  target: string;
  sourceSkills: string[];
  targetSkills: string[];
  diff: DiffResult;
}

function hashFile(filePath: string): string {
  try {
    const content = readFileSync(filePath);
    return createHash('md5').update(content).digest('hex').slice(0, 8);
  } catch {
    return 'error';
  }
}

function hashDirectory(dirPath: string): { hash: string; files: { name: string; hash: string }[] } {
  const files: { name: string; hash: string }[] = [];
  
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isFile()) {
        files.push({ name: entry, hash: hashFile(fullPath) });
      }
    }
  } catch {
    // Directory not readable
  }

  // Create overall hash from file hashes
  const combinedHash = createHash('md5')
    .update(files.map(f => `${f.name}:${f.hash}`).join('|'))
    .digest('hex')
    .slice(0, 8);

  return { hash: combinedHash, files };
}

export function getSnapshotPath(): string {
  return join(getConfigDir(), 'snapshot.json');
}

export function loadSnapshot(): Map<string, SkillSnapshot> | null {
  const snapshotPath = getSnapshotPath();
  
  if (!existsSync(snapshotPath)) {
    return null;
  }

  try {
    const content = readFileSync(snapshotPath, 'utf-8');
    const data = JSON.parse(content) as SkillSnapshot[];
    return new Map(data.map(s => [s.id, s]));
  } catch {
    return null;
  }
}

export function saveSnapshot(skills: Map<string, SkillSnapshot>): void {
  const snapshotPath = getSnapshotPath();
  const configDir = getConfigDir();
  
  mkdirSync(configDir, { recursive: true });
  
  const data = Array.from(skills.values());
  writeFileSync(snapshotPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function createSnapshot(sourcePath: string): Map<string, SkillSnapshot> {
  const snapshots = new Map<string, SkillSnapshot>();
  
  if (!existsSync(sourcePath)) {
    return snapshots;
  }

  try {
    const entries = readdirSync(sourcePath);
    
    for (const entry of entries) {
      const skillPath = join(sourcePath, entry);
      const stat = statSync(skillPath);
      
      if (stat.isDirectory()) {
        const { hash, files } = hashDirectory(skillPath);
        snapshots.set(entry, {
          id: entry,
          hash,
          files,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch {
    // Source not readable
  }

  return snapshots;
}

export function diffSnapshots(
  previous: Map<string, SkillSnapshot> | null,
  current: Map<string, SkillSnapshot>
): DiffResult {
  const result: DiffResult = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };

  if (!previous) {
    // Everything is new
    result.added = Array.from(current.keys());
    return result;
  }

  // Check for added and modified
  for (const [id, snapshot] of current) {
    const prevSnapshot = previous.get(id);
    
    if (!prevSnapshot) {
      result.added.push(id);
    } else if (prevSnapshot.hash !== snapshot.hash) {
      result.modified.push(id);
    } else {
      result.unchanged.push(id);
    }
  }

  // Check for removed
  for (const id of previous.keys()) {
    if (!current.has(id)) {
      result.removed.push(id);
    }
  }

  return result;
}

export function diffSourceToTarget(sourcePath: string, targetPath: string): DiffResult {
  const result: DiffResult = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };

  const sourceSkills = new Set<string>();
  const targetSkills = new Set<string>();

  // Get source skills
  if (existsSync(sourcePath)) {
    try {
      for (const entry of readdirSync(sourcePath)) {
        const stat = statSync(join(sourcePath, entry));
        if (stat.isDirectory()) {
          sourceSkills.add(entry);
        }
      }
    } catch {}
  }

  // Get target skills
  if (existsSync(targetPath)) {
    try {
      for (const entry of readdirSync(targetPath)) {
        const fullPath = join(targetPath, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory() || stat.isSymbolicLink()) {
            targetSkills.add(entry);
          }
        } catch {}
      }
    } catch {}
  }

  // Compare
  for (const skill of sourceSkills) {
    if (!targetSkills.has(skill)) {
      result.added.push(skill); // In source, not in target - needs sync
    } else {
      // Check if symlink points to correct location
      const targetSkillPath = join(targetPath, skill);
      const sourceSkillPath = join(sourcePath, skill);
      
      try {
        const linkTarget = readlinkSync(targetSkillPath);
        if (linkTarget === sourceSkillPath) {
          result.unchanged.push(skill);
        } else {
          result.modified.push(skill); // Points to wrong location
        }
      } catch {
        // Not a symlink, it's a real directory
        result.modified.push(skill);
      }
    }
  }

  for (const skill of targetSkills) {
    if (!sourceSkills.has(skill)) {
      result.removed.push(skill); // In target, not in source - orphaned
    }
  }

  return result;
}

export function getTargetDiffs(sourcePath: string, targets: { name: string; path: string }[]): TargetDiff[] {
  const results: TargetDiff[] = [];

  const sourceSkills = existsSync(sourcePath) 
    ? readdirSync(sourcePath).filter(e => {
        try {
          return statSync(join(sourcePath, e)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];

  for (const target of targets) {
    const targetSkills = existsSync(target.path)
      ? readdirSync(target.path).filter(e => {
          try {
            const stat = statSync(join(target.path, e));
            return stat.isDirectory() || stat.isSymbolicLink();
          } catch {
            return false;
          }
        })
      : [];

    const diff = diffSourceToTarget(sourcePath, target.path);

    results.push({
      target: target.name,
      sourceSkills,
      targetSkills,
      diff,
    });
  }

  return results;
}
