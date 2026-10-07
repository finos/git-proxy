/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Schema } from '@orpc/server';
import type { ConditionalSchemaConverter, JSONSchema, SchemaConvertOptions } from '@orpc/openapi';
import { JSON_SCHEMA_INPUT_REGISTRY, ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { z } from 'zod';

const DOC_ONLY_VENDOR = 'git-proxy-doc-only';

/**
 * A schema that documents a value without validating it at runtime.
 *
 * Responses are only documented: validating them would turn data the API has
 * always returned (Mongo `ObjectId`s, `Action` class instances, extra fields)
 * into 500s or strip fields from it.
 */
export interface DocOnlySchema<T> extends Schema<T, T> {
  readonly '~docOnly': z.ZodType;
}

/**
 * Documents a response as `schema` while typing it as `T` and passing the
 * value through unchanged.
 * @param {z.ZodType} schema the zod schema used for the OpenAPI document
 * @return {DocOnlySchema} a pass-through schema
 */
export const docOnly = <T>(schema: z.ZodType): DocOnlySchema<T> => ({
  '~standard': {
    vendor: DOC_ONLY_VENDOR,
    version: 1,
    validate: (value: unknown) => ({ value: value as T }),
  },
  '~docOnly': schema,
});

/** Converts {@link docOnly} schemas by delegating to the zod converter. */
export class DocOnlySchemaConverter implements ConditionalSchemaConverter {
  constructor(private readonly zodConverter: ZodToJsonSchemaConverter) {}

  condition(schema: Schema<unknown, unknown> | undefined): boolean {
    return schema?.['~standard'].vendor === DOC_ONLY_VENDOR;
  }

  convert(
    schema: Schema<unknown, unknown> | undefined,
    options: SchemaConvertOptions,
  ): [required: boolean, jsonSchema: JSONSchema] {
    return this.zodConverter.convert((schema as DocOnlySchema<unknown>)['~docOnly'], options);
  }
}

const zodConverter = new ZodToJsonSchemaConverter();
export const schemaConverters = [new DocOnlySchemaConverter(zodConverter), zodConverter];

/**
 * An optional input field that accepts any value at runtime but is documented
 * as `jsonSchema`. Used where the handler checks the field itself and answers
 * with its own error message, so zod must not reject it first.
 * @param {JSONSchema} jsonSchema the documented schema
 * @return {z.ZodOptional<z.ZodUnknown>} an accept-anything zod schema
 */
export const documentedUnknown = (
  jsonSchema: Exclude<JSONSchema, boolean>,
): z.ZodOptional<z.ZodUnknown> => {
  const schema = z.unknown();
  JSON_SCHEMA_INPUT_REGISTRY.add(schema, jsonSchema as never);
  return schema.optional();
};

/**
 * Query string filters. The handlers read Express's `req.query`, so oRPC's
 * own parse of the query string is documented but never validated.
 */
export const FilterQuery = documentedUnknown({
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'Any record field to filter on; "true"/"false" match booleans',
});

export const ActivityCountsSchema = z.object({
  pending: z.number(),
  approved: z.number(),
  canceled: z.number(),
  rejected: z.number(),
  error: z.number(),
});

export const PublicUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  title: z.string(),
  scmIdentities: z.record(z.string(), z.string()),
  admin: z.boolean(),
  mustChangePassword: z.boolean().optional(),
  activity: ActivityCountsSchema.optional(),
});

export const RepoSchema = z.looseObject({
  _id: z.string().optional(),
  project: z.string(),
  name: z.string(),
  url: z.string(),
  users: z.object({ canPush: z.array(z.string()), canAuthorise: z.array(z.string()) }),
  dateCreated: z.string().optional(),
  lastModified: z.string().optional(),
  activity: ActivityCountsSchema.optional(),
  latestPendingReviewAtMs: z.number().optional(),
  latestPushAtMs: z.number().optional(),
  proxyURL: z.string(),
});

const ReviewerSchema = z.object({ username: z.string(), email: z.string() });

export const PushSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  method: z.string(),
  timestamp: z.number(),
  project: z.string(),
  repoName: z.string(),
  url: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  commitFrom: z.string().optional(),
  commitTo: z.string().optional(),
  user: z.string().optional(),
  userEmail: z.string().optional(),
  pusherVerified: z.boolean().optional(),
  error: z.boolean(),
  blocked: z.boolean(),
  allowPush: z.boolean(),
  authorised: z.boolean(),
  canceled: z.boolean(),
  rejected: z.boolean(),
  autoApproved: z.boolean().optional(),
  autoRejected: z.boolean().optional(),
  steps: z.array(z.looseObject({})).optional(),
  attestation: z
    .looseObject({ reviewer: ReviewerSchema, timestamp: z.string(), answers: z.array(z.unknown()) })
    .optional(),
  rejection: z
    .looseObject({ reviewer: ReviewerSchema, timestamp: z.string(), reason: z.string() })
    .optional(),
});

export const ScmMetadataSchema = z
  .object({
    description: z.string().optional(),
    language: z.string().optional(),
    license: z.string().optional(),
    htmlUrl: z.string().optional(),
    parentName: z.string().optional(),
    parentUrl: z.string().optional(),
    profileUrl: z.string().optional(),
    avatarUrl: z.string().optional(),
  })
  .nullable();

export const SshKeyFingerprintSchema = z.object({
  fingerprint: z.string(),
  name: z.string(),
  addedAt: z.string(),
});

export const TextSchema = z.string().describe('Plain text (text/html), empty when unset');
