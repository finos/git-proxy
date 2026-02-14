import { Convert, GitProxyConfig } from './generated/config';

const validationChain = [validateCommitConfig];

/**
 * Executes all custom validators on the configuration
 * @param config The configuration to validate
 * @returns true if the configuration is valid, false otherwise
 */
export const validateConfig = (config: GitProxyConfig): boolean => {
  return validationChain.every((validator) => validator(config));
};

/**
 * Validates that commit configuration uses valid regular expressions.
 * @param config The commit configuration to validate
 * @returns true if the commit configuration is valid, false otherwise
 */
function validateCommitConfig(config: GitProxyConfig): boolean {
  if (config.commitConfig?.author?.email?.local?.block) {
    try {
      new RegExp(config.commitConfig.author.email.local.block);
    } catch (error: unknown) {
      console.error(
        `Invalid regular expression for commitConfig.author.email.local.block: ${config.commitConfig.author.email.local.block}`,
      );
      return false;
    }
  }

  if (config.commitConfig?.author?.email?.domain?.allow) {
    try {
      new RegExp(config.commitConfig.author.email.domain.allow);
    } catch (error: unknown) {
      console.error(
        `Invalid regular expression for commitConfig.author.email.domain.allow: ${config.commitConfig.author.email.domain.allow}`,
      );
      return false;
    }
  }

  if (config.commitConfig?.message?.block?.patterns) {
    for (const pattern of config.commitConfig.message.block.patterns) {
      try {
        new RegExp(pattern);
      } catch (error: unknown) {
        console.error(
          `Invalid regular expression for commitConfig.message.block.patterns: ${pattern}`,
        );
        return false;
      }
    }
  }

  if (config.commitConfig?.diff?.block?.patterns) {
    for (const pattern of config.commitConfig.diff.block.patterns) {
      try {
        new RegExp(pattern);
      } catch (error: unknown) {
        console.error(
          `Invalid regular expression for commitConfig.diff.block.patterns: ${pattern}`,
        );
        return false;
      }
    }
  }

  if (config.commitConfig?.diff?.block?.providers) {
    for (const [key, value] of Object.entries(config.commitConfig.diff.block.providers)) {
      try {
        new RegExp(value);
      } catch (error: unknown) {
        console.error(`Invalid regular expression for commitConfig.diff.block.providers: ${value}`);
        return false;
      }
    }
  }

  return true;
}

export async function loadConfig(
  context: string,
  loader: () => Promise<string>,
): Promise<GitProxyConfig> {
  const raw = await loader();
  return parseGitProxyConfig(raw, context);
}

function parseGitProxyConfig(raw: string, context: string): GitProxyConfig {
  try {
    return Convert.toGitProxyConfig(raw);
  } catch (error) {
    throw new Error(
      `Invalid configuration format in ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
