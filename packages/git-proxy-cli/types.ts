export interface PushFilters {
  allowPush?: boolean;
  authorised?: boolean;
  blocked?: boolean;
  canceled?: boolean;
  error?: boolean;
  rejected?: boolean;
}

export interface PushData {
  id: string;
  timestamp: number;
  url: string;
  allowPush: boolean;
  authorised: boolean;
  blocked: boolean;
  canceled: boolean;
  error: boolean;
  rejected: boolean;
  lastStep?: PushStep;
  commitData?: CommitData[];
}

export interface PushStep {
  stepName: string;
  error: boolean;
  errorMessage: string;
  blocked: boolean;
  blockedMessage: string;
}

export interface CommitData {
  message: string;
  committer: string;
}
