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
