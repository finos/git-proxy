import { z } from 'zod';

const TempPasswordSchema = z.object({
  sendEmail: z.boolean().default(false),
  emailConfig: z.record(z.unknown()).default({}),
});

const AuthorisedItemSchema = z.object({
  project: z.string(),
  name: z.string(),
  url: z
    .string()
    .regex(/^(?:https?:\/\/.+\.git|git@[^:]+:[^/]+\/.+\.git)$/, {
      message: 'Must be a Git HTTPS URL (https://... .git) or SSH URL (git@...:... .git)',
    }),
});

const FsSinkSchema = z.object({
  type: z.literal('fs'),
  params: z.object({ filepath: z.string() }),
  enabled: z.boolean().default(true),
});

const MongoSinkSchema = z.object({
  type: z.literal('mongo'),
  connectionString: z.string(),
  options: z.object({
    useNewUrlParser: z.boolean().default(true),
    useUnifiedTopology: z.boolean().default(true),
    tlsAllowInvalidCertificates: z.boolean().default(false),
    ssl: z.boolean().default(false),
  }),
  enabled: z.boolean().default(false),
});

const SinkSchema = z.discriminatedUnion('type', [FsSinkSchema, MongoSinkSchema]);

const ActiveDirectoryConfigSchema = z.object({
  url: z.string(),
  baseDN: z.string(),
  searchBase: z.string(),
});

const LocalAuthSchema = z.object({
  type: z.literal('local'),
  enabled: z.boolean().default(true),
});

const ADAuthSchema = z.object({
  type: z.literal('ActiveDirectory'),
  enabled: z.boolean().default(false),
  adminGroup: z.string().default(''),
  userGroup: z.string().default(''),
  domain: z.string().default(''),
  adConfig: ActiveDirectoryConfigSchema,
});

const AuthenticationSchema = z.discriminatedUnion('type', [LocalAuthSchema, ADAuthSchema]);

const GithubApiSchema = z.object({
  baseUrl: z.string().url(),
});

const CommitEmailSchema = z.object({
  local: z.object({ block: z.string().default('') }),
  domain: z.object({ allow: z.string().default('.*') }),
});

const CommitBlockSchema = z.object({
  literals: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
});

const CommitDiffSchema = z.object({
  block: z.object({
    literals: z.array(z.string()).default([]),
    patterns: z.array(z.string()).default([]),
    providers: z.record(z.unknown()).default({}),
  }),
});

const AttestationQuestionSchema = z.object({
  label: z.string(),
  tooltip: z.object({
    text: z.string(),
    links: z.array(z.string()).default([]),
  }),
});

export const ConfigSchema = z
  .object({
    proxyUrl: z.string().url().default('https://github.com'),
    cookieSecret: z.string().default(''),
    sessionMaxAgeHours: z.number().int().positive().default(12),
    tempPassword: TempPasswordSchema.default({}),
    authorisedList: z.array(AuthorisedItemSchema).default([]),
    sink: z.array(SinkSchema).default([]),
    authentication: z.array(AuthenticationSchema).default([{ type: 'local', enabled: true }]),
    api: z
      .object({
        github: GithubApiSchema,
      })
      .default({ github: { baseUrl: 'https://api.github.com' } }),
    commitConfig: z
      .object({
        author: z.object({ email: CommitEmailSchema }),
        message: z.object({ block: CommitBlockSchema }),
        diff: CommitDiffSchema,
      })
      .default({
        author: { email: { local: { block: '' }, domain: { allow: '.*' } } },
        message: { block: { literals: [], patterns: [] } },
        diff: { block: { literals: [], patterns: [], providers: {} } },
      }),
    attestationConfig: z
      .object({
        questions: z.array(AttestationQuestionSchema).default([]),
      })
      .default({ questions: [] }),
    domains: z.record(z.string(), z.string()).default({}),
    privateOrganizations: z.array(z.string()).default([]),
    urlShortener: z.string().default(''),
    contactEmail: z.string().default(''),
    csrfProtection: z.boolean().default(true),
    plugins: z.array(z.unknown()).default([]),
    tls: z
      .object({
        enabled: z.boolean().default(false),
        key: z.string().default(''),
        cert: z.string().default(''),
      })
      .default({}),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
