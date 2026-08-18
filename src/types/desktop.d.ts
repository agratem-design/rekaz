export interface BackupStatusEvent {
  status: 'idle' | 'starting' | 'dumping' | 'dump_completed' | 'uploading' | 'completed' | 'error';
  message: string;
  triggerType?: 'auto' | 'manual';
  fileName?: string;
  filePath?: string;
  fileSize?: string;
  fileSizeBytes?: number;
  driveUploaded?: boolean;
  driveError?: string | null;
  error?: string;
  completedAt?: string;
}

export interface LocalBackupFile {
  name: string;
  path: string;
  size: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DesktopBackupStatus {
  status: string;
  lastRunTime: string | null;
  lastFileName: string | null;
  lastFilePath: string | null;
  lastFileSize: string | null;
  lastError: string | null;
  backupDir: string;
  localBackups: LocalBackupFile[];
  pgDumpPath: string;
}

export interface DesktopAPI {
  isDesktop: boolean;
  startBackup: () => Promise<{ success: boolean; result?: any; error?: string }>;
  openBackupFolder: (filePath?: string) => Promise<{ success: boolean; error?: string }>;
  getBackupStatus: () => Promise<DesktopBackupStatus>;
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    isPackaged: boolean;
    platform: string;
    arch: string;
    userData: string;
  }>;
  onBackupStatus: (callback: (status: BackupStatusEvent) => void) => () => void;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
