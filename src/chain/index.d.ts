export function executeChain(req: {
  method: string;
  originalUrl: string;
  isSSH: boolean;
  headers: Record<string, string | undefined>;
}): Promise<{
  error?: boolean;
  blocked?: boolean;
  errorMessage?: string;
  blockedMessage?: string;
}>;
