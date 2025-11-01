import { StepData } from '../proxy/actions/Step';
import { CommitData } from '../proxy/processors/types';

export interface UserData {
  id: string;
  name: string;
  username: string;
  email?: string;
  displayName?: string;
  title?: string;
  gitAccount?: string;
  admin?: boolean;
}

export interface PushData {
  id: string;
  url: string;
  repo: string;
  branch: string;
  commitFrom: string;
  commitTo: string;
  commitData: CommitData[];
  diff: {
    content: string;
  };
  error: boolean;
  canceled?: boolean;
  rejected?: boolean;
  blocked?: boolean;
  authorised?: boolean;
  attestation?: AttestationFormData;
  autoApproved?: boolean;
  timestamp: string | Date;
  allowPush?: boolean;
  lastStep?: StepData;
}

export interface RepositoryData {
  _id?: string;
  project: string;
  name: string;
  url: string;
  maxUser: number;
  lastModified?: string;
  dateCreated?: string;
  proxyURL?: string;
  users?: {
    canPush?: string[];
    canAuthorise?: string[];
  };
}

export type RepositoryDataWithId = Required<Pick<RepositoryData, '_id'>> & RepositoryData;

interface QuestionTooltipLink {
  text: string;
  url: string;
}

interface QuestionTooltip {
  text: string;
  links?: QuestionTooltipLink[];
}

export interface QuestionFormData {
  label: string;
  checked: boolean;
  tooltip: QuestionTooltip;
}

interface Reviewer {
  username: string;
  gitAccount: string;
}

export interface AttestationFormData {
  reviewer: Reviewer;
  timestamp: string | Date;
  questions: QuestionFormData[];
}

export interface Route {
  path: string;
  layout: string;
  name: string;
  rtlName?: string;
  component: React.ComponentType<any>;
  icon?: string | React.ComponentType<any>;
  visible?: boolean;
}
