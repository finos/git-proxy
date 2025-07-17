export interface RepositoriesProps {
  data?: {
    project: string;
    name: string;
    proxyURL: string;
    users?: {
      canPush?: string[];
      canAuthorise?: string[];
    };
  };

  [key: string]: unknown;
}
