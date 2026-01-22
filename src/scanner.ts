import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { glob } from 'glob';
import type { ParsedSkill, SkillYaml, SharpEdgesYaml, ValidationsYaml, CollaborationYaml } from './types.js';

const DEFAULT_SKILL_PATHS = [
  // Local spawner skills
  join(process.env.HOME || '~', '.spawner', 'skills'),
  // Claude Code skills  
  join(process.env.HOME || '~', '.claude', 'skills'),
  // Cursor skills
  join(process.env.HOME || '~', '.cursor', 'skills'),
  // Codex skills
  join(process.env.HOME || '~', '.codex', 'skills'),
  // Gemini skills
  join(process.env.HOME || '~', '.gemini', 'skills'),
  // OpenCode skills
  join(process.env.HOME || '~', '.opencode', 'skills'),
];

function safeParseYaml<T>(content: string): T | undefined {
  try {
    return parseYaml(content) as T;
  } catch {
    return undefined;
  }
}

function readFileIfExists(path: string): string | undefined {
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8');
    }
  } catch {
    // Ignore read errors
  }
  return undefined;
}

function parseSkillDirectory(skillPath: string, source: ParsedSkill['source']): ParsedSkill | null {
  const skillYamlPath = join(skillPath, 'skill.yaml');
  const skillMdPath = join(skillPath, 'SKILL.md');
  
  // Try skill.yaml first
  let skillYamlContent = readFileIfExists(skillYamlPath);
  let skillYaml: SkillYaml | undefined;
  
  if (skillYamlContent) {
    skillYaml = safeParseYaml<SkillYaml>(skillYamlContent);
  }
  
  // If no skill.yaml, check for SKILL.md (spawner format)
  const hasSkillMd = existsSync(skillMdPath);
  
  // Must have either skill.yaml or SKILL.md to be valid
  if (!skillYaml && !hasSkillMd) {
    return null;
  }

  // Get folder name as fallback ID
  const folderName = basename(skillPath);
  
  // If no skill.yaml but has SKILL.md, create minimal skillYaml from folder
  if (!skillYaml && hasSkillMd) {
    skillYaml = {
      id: folderName,
      name: folderName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    };
  }

  if (!skillYaml || !skillYaml.id) {
    // Use folder name as ID if missing
    if (skillYaml) {
      skillYaml.id = folderName;
    } else {
      return null;
    }
  }

  // Parse optional YAML files
  const sharpEdgesContent = readFileIfExists(join(skillPath, 'sharp-edges.yaml'));
  const validationsContent = readFileIfExists(join(skillPath, 'validations.yaml'));
  const collaborationContent = readFileIfExists(join(skillPath, 'collaboration.yaml'));

  // Check for markdown files
  const hasPatternsMd = existsSync(join(skillPath, 'patterns.md'));
  const hasAntiPatternsMd = existsSync(join(skillPath, 'anti-patterns.md'));
  const hasDecisionsMd = existsSync(join(skillPath, 'decisions.md'));
  const hasSharpEdgesMd = existsSync(join(skillPath, 'sharp-edges.md'));

  return {
    id: skillYaml.id,
    name: skillYaml.name || skillYaml.id,
    path: skillPath,
    source,
    skillYaml,
    sharpEdgesYaml: sharpEdgesContent ? safeParseYaml<SharpEdgesYaml>(sharpEdgesContent) : undefined,
    validationsYaml: validationsContent ? safeParseYaml<ValidationsYaml>(validationsContent) : undefined,
    collaborationYaml: collaborationContent ? safeParseYaml<CollaborationYaml>(collaborationContent) : undefined,
    hasPatternsMd,
    hasAntiPatternsMd,
    hasDecisionsMd,
    hasSharpEdgesMd,
  };
}

function scanDirectory(basePath: string, source: ParsedSkill['source']): ParsedSkill[] {
  const skills: ParsedSkill[] = [];
  
  if (!existsSync(basePath)) {
    return skills;
  }

  try {
    const entries = readdirSync(basePath);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue; // Skip hidden
      
      const entryPath = join(basePath, entry);
      
      try {
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          // First, try to parse as a skill directly
          const skill = parseSkillDirectory(entryPath, source);
          if (skill) {
            skills.push(skill);
          } else {
            // Not a skill - check if it's a category folder (public, user, examples)
            // containing skills one level deeper
            const subEntries = readdirSync(entryPath);
            for (const subEntry of subEntries) {
              if (subEntry.startsWith('.')) continue;
              
              const subPath = join(entryPath, subEntry);
              try {
                const subStat = statSync(subPath);
                if (subStat.isDirectory()) {
                  const subSkill = parseSkillDirectory(subPath, source);
                  if (subSkill) {
                    skills.push(subSkill);
                  }
                }
              } catch {
                // Skip unreadable
              }
            }
          }
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Directory not readable
  }

  return skills;
}

export interface ScanOptions {
  paths?: string[];
  includeRemote?: boolean;
}

export async function scanSkills(options: ScanOptions = {}): Promise<ParsedSkill[]> {
  const paths = options.paths || DEFAULT_SKILL_PATHS;
  const allSkills: ParsedSkill[] = [];
  const seenIds = new Set<string>();

  for (const basePath of paths) {
    const source: ParsedSkill['source'] = basePath.includes('.spawner') ? 'local' : 'community';
    const skills = scanDirectory(basePath, source);
    
    for (const skill of skills) {
      // Track duplicates - keep first occurrence, note the duplicate
      if (!seenIds.has(skill.id)) {
        seenIds.add(skill.id);
        allSkills.push(skill);
      }
    }
  }

  return allSkills;
}

export function getDefaultPaths(): string[] {
  return DEFAULT_SKILL_PATHS.filter(p => existsSync(p));
}
