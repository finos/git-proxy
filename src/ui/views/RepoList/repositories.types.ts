export interface RepositoriesProps {
  data?: {
    _id: string;
    project: string;
    name: string;
    url: string;
    proxyURL: string;
    users?: {
      canPush?: string[];
      canAuthorise?: string[];
    };
  };

  [key: string]: unknown;
}
