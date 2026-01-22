export interface GenauraConfig {
    version: string;
    source: string;
    minScore: number;
    autoBackup: boolean;
    targets: {
        name: string;
        path: string;
        enabled: boolean;
    }[];
    remotes: {
        name: string;
        url: string;
        lastSync?: string;
    }[];
}
export declare function getConfigDir(): string;
export declare function getConfigPath(): string;
export declare function configExists(): boolean;
export declare function loadConfig(): GenauraConfig | null;
export declare function saveConfig(config: GenauraConfig): void;
export declare function createDefaultConfig(detectedTargets: {
    name: string;
    path: string;
}[], sourcePath: string): GenauraConfig;
export declare function detectInstalledCLIs(): {
    name: string;
    path: string;
    exists: boolean;
}[];
export declare function detectSourcePath(): string;
