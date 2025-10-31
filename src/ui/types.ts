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
