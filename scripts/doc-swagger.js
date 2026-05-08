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

const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const SWAGGER_FILE = './dist/swagger.json';
const OUTPUT_DIR = './website/docs/api';

const METHOD_COLORS = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  patch: '#50e3c2',
  delete: '#f93e3e',
};

const STATUS_DESCRIPTIONS = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

function loadSpec() {
  const raw = readFileSync(SWAGGER_FILE, 'utf-8');
  return JSON.parse(raw);
}

function httpMethodOrder(method) {
  const order = { get: 0, post: 1, put: 2, patch: 3, delete: 4 };
  return order[method] ?? 5;
}

function resolveRef(ref, spec) {
  const path = ref.replace('#/', '').split('/');
  let current = spec;
  for (const segment of path) {
    current = current[segment];
    if (!current) return null;
  }
  return current;
}

function resolveSchema(schema, spec) {
  if (!schema) return null;
  if (schema.$ref) return resolveRef(schema.$ref, spec);
  return schema;
}

function formatType(schema, spec) {
  if (!schema) return '`any`';
  const resolved = resolveSchema(schema, spec);
  if (!resolved) return '`any`';

  if (resolved.type === 'array') {
    const itemType = resolved.items ? formatType(resolved.items, spec) : '`any`';
    return `${itemType}[]`;
  }

  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    return `\`${name}\``;
  }

  if (resolved.enum) {
    return resolved.enum.map((v) => `\`"${v}"\``).join(' \\| ');
  }

  return `\`${resolved.type || 'object'}\``;
}

function methodBadge(method) {
  const color = METHOD_COLORS[method] || '#999';
  const label = method.toUpperCase();
  return `<span style={{background: '${color}', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 'bold', fontSize: '0.85rem', fontFamily: 'monospace'}}>${label}</span>`;
}

function authBadge() {
  return `<span style={{background: '#f0ad4e', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '0.5rem'}}>AUTH</span>`;
}

function statusBadge(code) {
  let color = '#49cc90';
  if (code >= 400 && code < 500) color = '#fca130';
  if (code >= 500) color = '#f93e3e';
  if (code >= 300 && code < 400) color = '#61affe';
  return `<code style={{background: '${color}22', color: '${color}', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontWeight: 'bold'}}>${code}</code>`;
}

function renderSchemaProperties(schema, spec) {
  const resolved = resolveSchema(schema, spec);
  if (!resolved || !resolved.properties) return '';

  const required = new Set(resolved.required || []);
  let lines = [];

  lines.push('| Field | Type | Required | Description |');
  lines.push('|-------|------|:--------:|-------------|');

  for (const [name, prop] of Object.entries(resolved.properties)) {
    const propResolved = resolveSchema(prop, spec);
    const type = formatType(prop, spec);
    const isRequired = required.has(name) ? '**Yes**' : 'No';
    const desc = (propResolved?.description || '').replace(/\|/g, '\\|');
    lines.push(`| \`${name}\` | ${type} | ${isRequired} | ${desc} |`);
  }

  return lines.join('\n');
}

function renderParameters(parameters, spec) {
  if (!parameters || parameters.length === 0) return '';

  const params = parameters.map((p) => (p.$ref ? resolveRef(p.$ref, spec) : p)).filter(Boolean);
  if (params.length === 0) return '';

  let lines = [];
  lines.push('#### Parameters\n');
  lines.push('| Name | In | Type | Required | Description |');
  lines.push('|------|:---:|------|:--------:|-------------|');

  for (const param of params) {
    const type = formatType(param.schema, spec);
    const required = param.required ? '**Yes**' : 'No';
    const desc = (param.description || '').replace(/\|/g, '\\|');
    const inBadge = param.in === 'path' ? '`path`' : '`query`';
    lines.push(`| \`${param.name}\` | ${inBadge} | ${type} | ${required} | ${desc} |`);
  }

  return lines.join('\n');
}

function renderRequestBody(requestBody, spec) {
  if (!requestBody) return '';

  const content = requestBody.content;
  if (!content) return '';

  const jsonContent = content['application/json'];
  if (!jsonContent || !jsonContent.schema) return '';

  const schema = resolveSchema(jsonContent.schema, spec);
  if (!schema) return '';

  let lines = ['#### Request Body\n'];
  const table = renderSchemaProperties(jsonContent.schema, spec);
  if (table) {
    lines.push(table);
  } else {
    lines.push(`Type: ${formatType(jsonContent.schema, spec)}`);
  }
  return lines.join('\n');
}

function renderResponses(responses) {
  if (!responses) return '';

  let lines = ['#### Responses\n'];

  for (const [status, response] of Object.entries(responses)) {
    const code = parseInt(status, 10);
    const badge = statusBadge(code);
    const desc = response.description || STATUS_DESCRIPTIONS[code] || '';
    lines.push(`- ${badge} ${desc}`);
  }

  return lines.join('\n');
}

function renderSecurityNote(security) {
  if (!security || security.length === 0) return '';
  return ':::info[Authorization Required]\nThis endpoint requires a valid **JWT Bearer token** in the `Authorization` header.\n:::';
}

function countEndpoints(operations) {
  const methods = {};
  for (const op of operations) {
    const m = op.method.toUpperCase();
    methods[m] = (methods[m] || 0) + 1;
  }
  return Object.entries(methods)
    .map(([m, c]) => `${c} ${m}`)
    .join(', ');
}

function generateTagPage(tag, operations, spec) {
  let lines = [];

  lines.push('---');
  lines.push(`title: ${tag}`);
  lines.push(`description: ${tag} API endpoints for GitProxy`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${tag}\n`);

  const tagDesc = (spec.tags || []).find((t) => t.name === tag);
  if (tagDesc && tagDesc.description) {
    lines.push(`${tagDesc.description}\n`);
  }

  lines.push(
    `*${operations.length} endpoint${operations.length !== 1 ? 's' : ''} — ${countEndpoints(operations)}*\n`,
  );

  operations.sort((a, b) => {
    const methodDiff = httpMethodOrder(a.method) - httpMethodOrder(b.method);
    if (methodDiff !== 0) return methodDiff;
    return a.path.localeCompare(b.path);
  });

  for (const op of operations) {
    const badge = methodBadge(op.method);
    const auth = op.security && op.security.length > 0 ? authBadge() : '';

    lines.push(`## ${badge} \`${op.path}\`${auth}\n`);

    if (op.description) {
      lines.push(`${op.description}\n`);
    } else if (op.summary) {
      lines.push(`${op.summary}\n`);
    }

    const secNote = renderSecurityNote(op.security);
    if (secNote) {
      lines.push(`${secNote}\n`);
    }

    const params = renderParameters(op.parameters, spec);
    if (params) {
      lines.push(`${params}\n`);
    }

    const body = renderRequestBody(op.requestBody, spec);
    if (body) {
      lines.push(`${body}\n`);
    }

    const responses = renderResponses(op.responses);
    if (responses) {
      lines.push(`${responses}\n`);
    }

    lines.push('---\n');
  }

  return lines.join('\n');
}

function generateIndexPage(spec, tagList, tagOperations) {
  const info = spec.info || {};
  let lines = [];

  lines.push('---');
  lines.push('title: API Reference');
  lines.push('description: REST API reference documentation for GitProxy');
  lines.push('---');
  lines.push('');
  lines.push('# API Reference\n');

  if (info.description) {
    lines.push(`${info.description}\n`);
  }

  lines.push(`:::info[API Version]\n**${info.version || 'unknown'}** — OpenAPI 3.0\n:::\n`);

  const securitySchemes = spec.components?.securitySchemes;
  if (securitySchemes) {
    lines.push('## Authentication\n');
    for (const [name, scheme] of Object.entries(securitySchemes)) {
      if (scheme.type === 'http') {
        lines.push(
          `Most endpoints require a **${scheme.scheme.toUpperCase()}** token${scheme.bearerFormat ? ` (${scheme.bearerFormat})` : ''} passed via the \`Authorization\` header:\n`,
        );
        lines.push('```\nAuthorization: Bearer <token>\n```\n');
      } else {
        lines.push(`- **${name}**: ${scheme.type}\n`);
      }
    }
  }

  lines.push('## Endpoints\n');

  const totalEndpoints = Object.values(tagOperations).reduce((sum, ops) => sum + ops.length, 0);
  lines.push(`${totalEndpoints} endpoints across ${tagList.length} groups:\n`);

  for (const tag of tagList) {
    const slug = tag.toLowerCase().replace(/\s+/g, '-');
    const ops = tagOperations[tag];
    const summary = countEndpoints(ops);
    lines.push(`- [**${tag}**](/docs/api/${slug}) — ${summary}`);
  }

  lines.push('');
  return lines.join('\n');
}

function main() {
  let spec;
  try {
    spec = loadSpec();
  } catch (err) {
    console.error(`Failed to read ${SWAGGER_FILE}: ${err.message}`);
    console.error('Run "npm run build-tsoa" first to generate the OpenAPI spec.');
    process.exit(1);
  }

  const tagOperations = {};

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['parameters', 'summary', 'description'].includes(method)) continue;

      const tags = operation.tags || ['Default'];
      for (const tag of tags) {
        if (!tagOperations[tag]) tagOperations[tag] = [];
        tagOperations[tag].push({
          path,
          method,
          ...operation,
        });
      }
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const tagList = Object.keys(tagOperations).sort();

  const indexContent = generateIndexPage(spec, tagList, tagOperations);
  writeFileSync(join(OUTPUT_DIR, 'index.mdx'), indexContent);
  console.log(`Wrote ${join(OUTPUT_DIR, 'index.mdx')}`);

  for (const [tag, operations] of Object.entries(tagOperations)) {
    const slug = tag.toLowerCase().replace(/\s+/g, '-');
    const content = generateTagPage(tag, operations, spec);
    writeFileSync(join(OUTPUT_DIR, `${slug}.mdx`), content);
    console.log(`Wrote ${join(OUTPUT_DIR, `${slug}.mdx`)}`);
  }

  console.log(`\nGenerated API docs for ${tagList.length} tag(s): ${tagList.join(', ')}`);
}

main();
