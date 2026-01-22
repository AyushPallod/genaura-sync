import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

export interface RemoteSkill {
  url: string;
  name: string;
  owner: string;
  repo: string;
  path?: string; // Subfolder within repo
}

export interface FetchResult {
  success: boolean;
  skillId: string;
  path: string;
  error?: string;
}

/**
 * Parse GitHub URL into components
 * Supports:
 * - https://github.com/user/repo
 * - https://github.com/user/repo/tree/main/skills/my-skill
 * - github.com/user/repo
 * - user/repo
 */
export function parseGitHubUrl(input: string): RemoteSkill | null {
  let url = input.trim();
  
  // Handle shorthand: user/repo
  if (/^[\w-]+\/[\w-]+$/.test(url)) {
    url = `https://github.com/${url}`;
  }
  
  // Add https if missing
  if (url.startsWith('github.com')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    
    if (!parsed.hostname.includes('github.com')) {
      return null;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // Check for subfolder path: /tree/main/path/to/skill
    let subPath: string | undefined;
    if (pathParts.length > 4 && pathParts[2] === 'tree') {
      // Skip 'tree' and branch name
      subPath = pathParts.slice(4).join('/');
    }

    return {
      url: `https://github.com/${owner}/${repo}`,
      name: subPath ? basename(subPath) : repo,
      owner,
      repo,
      path: subPath,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a skill from GitHub
 */
export async function fetchRemoteSkill(
  remote: RemoteSkill,
  targetDir: string
): Promise<FetchResult> {
  const skillDir = join(targetDir, remote.name);

  try {
    // Check if already exists
    if (existsSync(skillDir)) {
      return {
        success: false,
        skillId: remote.name,
        path: skillDir,
        error: 'Skill already exists. Use --force to overwrite.',
      };
    }

    // Create temp directory for clone
    const tempDir = join(targetDir, `.tmp-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      // Shallow clone
      execSync(`git clone --depth 1 ${remote.url}.git ${tempDir}`, {
        stdio: 'pipe',
      });

      // Determine source path
      const sourceInTemp = remote.path 
        ? join(tempDir, remote.path)
        : tempDir;

      if (!existsSync(sourceInTemp)) {
        throw new Error(`Path not found in repo: ${remote.path}`);
      }

      // Check if it's a valid skill (has skill.yaml)
      const skillYamlPath = join(sourceInTemp, 'skill.yaml');
      if (!existsSync(skillYamlPath)) {
        // Maybe it's a repo of skills, not a single skill
        throw new Error('No skill.yaml found. Is this a valid skill?');
      }

      // Move to final location
      mkdirSync(skillDir, { recursive: true });
      execSync(`cp -r ${sourceInTemp}/* ${skillDir}/`, { stdio: 'pipe' });

      return {
        success: true,
        skillId: remote.name,
        path: skillDir,
      };
    } finally {
      // Cleanup temp
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    return {
      success: false,
      skillId: remote.name,
      path: skillDir,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch multiple skills from a repo containing many skills
 */
export async function fetchSkillsRepo(
  repoUrl: string,
  targetDir: string
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const remote = parseGitHubUrl(repoUrl);

  if (!remote) {
    return [{
      success: false,
      skillId: 'unknown',
      path: '',
      error: 'Invalid GitHub URL',
    }];
  }

  const tempDir = join(targetDir, `.tmp-repo-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });

    // Clone the repo
    execSync(`git clone --depth 1 ${remote.url}.git ${tempDir}`, {
      stdio: 'pipe',
    });

    // Find all skill.yaml files
    const { execSync: exec } = await import('child_process');
    const findResult = exec(`find ${tempDir} -name "skill.yaml" -type f`, {
      encoding: 'utf-8',
    });

    const skillYamls = findResult.trim().split('\n').filter(Boolean);

    for (const yamlPath of skillYamls) {
      const skillSourceDir = join(yamlPath, '..');
      const skillName = basename(skillSourceDir);
      const skillTargetDir = join(targetDir, skillName);

      if (existsSync(skillTargetDir)) {
        results.push({
          success: false,
          skillId: skillName,
          path: skillTargetDir,
          error: 'Already exists',
        });
        continue;
      }

      try {
        mkdirSync(skillTargetDir, { recursive: true });
        execSync(`cp -r ${skillSourceDir}/* ${skillTargetDir}/`, { stdio: 'pipe' });
        results.push({
          success: true,
          skillId: skillName,
          path: skillTargetDir,
        });
      } catch (err) {
        results.push({
          success: false,
          skillId: skillName,
          path: skillTargetDir,
          error: err instanceof Error ? err.message : 'Copy failed',
        });
      }
    }

    return results;
  } catch (error) {
    return [{
      success: false,
      skillId: remote.repo,
      path: '',
      error: error instanceof Error ? error.message : 'Clone failed',
    }];
  } finally {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Update a remote skill (pull latest)
 */
export async function updateRemoteSkill(skillPath: string): Promise<{ success: boolean; error?: string }> {
  const gitDir = join(skillPath, '.git');
  
  if (!existsSync(gitDir)) {
    return { success: false, error: 'Not a git repository' };
  }

  try {
    execSync('git pull --ff-only', { cwd: skillPath, stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Pull failed' 
    };
  }
}
