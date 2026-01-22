export interface RemoteSkill {
    url: string;
    name: string;
    owner: string;
    repo: string;
    path?: string;
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
export declare function parseGitHubUrl(input: string): RemoteSkill | null;
/**
 * Fetch a skill from GitHub
 */
export declare function fetchRemoteSkill(remote: RemoteSkill, targetDir: string): Promise<FetchResult>;
/**
 * Fetch multiple skills from a repo containing many skills
 */
export declare function fetchSkillsRepo(repoUrl: string, targetDir: string): Promise<FetchResult[]>;
/**
 * Update a remote skill (pull latest)
 */
export declare function updateRemoteSkill(skillPath: string): Promise<{
    success: boolean;
    error?: string;
}>;
