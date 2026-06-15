/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserController } from './controllers/UserController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { RepoController } from './controllers/RepoController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PushController } from './controllers/PushController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { HomeController } from './controllers/HomeController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { HealthController } from './controllers/HealthController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ConfigController } from './controllers/ConfigController';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './controllers/AuthController';
import { expressAuthentication } from './authentication';
// @ts-ignore - no great way to install types from subpackage
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';

const expressAuthenticationRecasted = expressAuthentication as (req: ExRequest, securityName: string, scopes?: string[], res?: ExResponse) => Promise<any>;


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "PublicUser": {
        "dataType": "refObject",
        "properties": {
            "username": {"dataType":"string","required":true},
            "displayName": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "title": {"dataType":"string","required":true},
            "gitAccount": {"dataType":"string","required":true},
            "admin": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SSHKeyFingerprint": {
        "dataType": "refObject",
        "properties": {
            "fingerprint": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "addedAt": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AddSSHKeyResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"string","required":true},
            "fingerprint": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AddSSHKeyBody": {
        "dataType": "refObject",
        "properties": {
            "publicKey": {"dataType":"string"},
            "name": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RemoveSSHKeyResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RepoWithProxy": {
        "dataType": "refObject",
        "properties": {
            "project": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "url": {"dataType":"string","required":true},
            "users": {"dataType":"nestedObjectLiteral","nestedProperties":{"canAuthorise":{"dataType":"array","array":{"dataType":"string"},"required":true},"canPush":{"dataType":"array","array":{"dataType":"string"},"required":true}},"required":true},
            "_id": {"dataType":"string"},
            "proxyURL": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "MessageResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CreateRepoBody": {
        "dataType": "refObject",
        "properties": {
            "url": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "project": {"dataType":"string","required":true},
            "users": {"dataType":"nestedObjectLiteral","nestedProperties":{"canAuthorise":{"dataType":"array","array":{"dataType":"string"},"required":true},"canPush":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
            "_id": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UsernameBody": {
        "dataType": "refObject",
        "properties": {
            "username": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Step": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "stepName": {"dataType":"string","required":true},
            "content": {"dataType":"any","required":true},
            "error": {"dataType":"boolean","required":true},
            "errorMessage": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "blocked": {"dataType":"boolean","required":true},
            "blockedMessage": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "logs": {"dataType":"array","array":{"dataType":"string"},"default":[]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CommitData": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true},"commitTimestamp":{"dataType":"string","required":true},"committerEmail":{"dataType":"string","required":true},"authorEmail":{"dataType":"string","required":true},"committer":{"dataType":"string","required":true},"author":{"dataType":"string","required":true},"parent":{"dataType":"string","required":true},"tree":{"dataType":"string","required":true}},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AttestationBase": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{"automated":{"dataType":"boolean"},"timestamp":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"datetime"}],"required":true},"reviewer":{"dataType":"nestedObjectLiteral","nestedProperties":{"email":{"dataType":"string","required":true},"username":{"dataType":"string","required":true}},"required":true}},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AttestationAnswer": {
        "dataType": "refObject",
        "properties": {
            "label": {"dataType":"string","required":true},
            "checked": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CompletedAttestation": {
        "dataType": "refAlias",
        "type": {"dataType":"intersection","subSchemas":[{"ref":"AttestationBase"},{"dataType":"nestedObjectLiteral","nestedProperties":{"answers":{"dataType":"array","array":{"dataType":"refObject","ref":"AttestationAnswer"},"required":true}}}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Rejection": {
        "dataType": "refAlias",
        "type": {"dataType":"intersection","subSchemas":[{"ref":"AttestationBase"},{"dataType":"nestedObjectLiteral","nestedProperties":{"reason":{"dataType":"string","required":true}}}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Action": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"string","required":true},
            "method": {"dataType":"string","required":true},
            "timestamp": {"dataType":"double","required":true},
            "project": {"dataType":"string","required":true},
            "repoName": {"dataType":"string","required":true},
            "url": {"dataType":"string","required":true},
            "repo": {"dataType":"string","required":true},
            "steps": {"dataType":"array","array":{"dataType":"refObject","ref":"Step"},"default":[]},
            "error": {"dataType":"boolean","default":false},
            "errorMessage": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "blocked": {"dataType":"boolean","default":false},
            "blockedMessage": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "allowPush": {"dataType":"boolean","default":false},
            "authorised": {"dataType":"boolean","default":false},
            "canceled": {"dataType":"boolean","default":false},
            "rejected": {"dataType":"boolean","default":false},
            "autoApproved": {"dataType":"boolean","default":false},
            "autoRejected": {"dataType":"boolean","default":false},
            "commitData": {"dataType":"array","array":{"dataType":"refAlias","ref":"CommitData"},"default":[]},
            "commitFrom": {"dataType":"string"},
            "commitTo": {"dataType":"string"},
            "branch": {"dataType":"string"},
            "message": {"dataType":"string"},
            "author": {"dataType":"string"},
            "user": {"dataType":"string"},
            "userEmail": {"dataType":"string"},
            "attestation": {"ref":"CompletedAttestation"},
            "rejection": {"ref":"Rejection"},
            "lastStep": {"ref":"Step"},
            "proxyGitPath": {"dataType":"string"},
            "newIdxFiles": {"dataType":"array","array":{"dataType":"string"}},
            "protocol": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["https"]},{"dataType":"enum","enums":["ssh"]}]},
            "pullAuthStrategy": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["ssh-user-key"]},{"dataType":"enum","enums":["ssh-service-token"]},{"dataType":"enum","enums":["ssh-agent-forwarding"]},{"dataType":"enum","enums":["anonymous"]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RejectBody": {
        "dataType": "refObject",
        "properties": {
            "reason": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AuthoriseBody": {
        "dataType": "refObject",
        "properties": {
            "params": {"dataType":"nestedObjectLiteral","nestedProperties":{"attestation":{"dataType":"array","array":{"dataType":"refObject","ref":"AttestationAnswer"},"required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ApiResources": {
        "dataType": "refObject",
        "properties": {
            "healthcheck": {"dataType":"string","required":true},
            "push": {"dataType":"string","required":true},
            "auth": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HealthResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"enum","enums":["ok"],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Link": {
        "dataType": "refObject",
        "properties": {
            "text": {"dataType":"string","required":true},
            "url": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "QuestionTooltip": {
        "dataType": "refObject",
        "properties": {
            "links": {"dataType":"array","array":{"dataType":"refObject","ref":"Link"}},
            "text": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Question": {
        "dataType": "refObject",
        "properties": {
            "label": {"dataType":"string","required":true},
            "tooltip": {"ref":"QuestionTooltip","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AttestationConfig": {
        "dataType": "refObject",
        "properties": {
            "questions": {"dataType":"array","array":{"dataType":"refObject","ref":"Question"}},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RouteAuthRule": {
        "dataType": "refObject",
        "properties": {
            "adminOnly": {"dataType":"boolean"},
            "loginRequired": {"dataType":"boolean"},
            "pattern": {"dataType":"string"},
        },
        "additionalProperties": {"dataType":"any"},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UIRouteAuth": {
        "dataType": "refObject",
        "properties": {
            "enabled": {"dataType":"boolean"},
            "rules": {"dataType":"array","array":{"dataType":"refObject","ref":"RouteAuthRule"}},
        },
        "additionalProperties": {"dataType":"any"},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HostKey": {
        "dataType": "refObject",
        "properties": {
            "privateKeyPath": {"dataType":"string","required":true},
            "publicKeyPath": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SSH": {
        "dataType": "refObject",
        "properties": {
            "agentForwardingErrorMessage": {"dataType":"string"},
            "debug": {"dataType":"boolean"},
            "enabled": {"dataType":"boolean","required":true},
            "hostKey": {"ref":"HostKey"},
            "knownHosts": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"string"}},
            "port": {"dataType":"double"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AuthResources": {
        "dataType": "refObject",
        "properties": {
            "login": {"dataType":"nestedObjectLiteral","nestedProperties":{"uri":{"dataType":"string","required":true},"action":{"dataType":"enum","enums":["post"],"required":true}},"required":true},
            "profile": {"dataType":"nestedObjectLiteral","nestedProperties":{"uri":{"dataType":"string","required":true},"action":{"dataType":"enum","enums":["get"],"required":true}},"required":true},
            "logout": {"dataType":"nestedObjectLiteral","nestedProperties":{"uri":{"dataType":"string","required":true},"action":{"dataType":"enum","enums":["post"],"required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "AuthConfigResponse": {
        "dataType": "refObject",
        "properties": {
            "usernamePasswordMethod": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "otherMethods": {"dataType":"array","array":{"dataType":"string"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CsrfTokenResponse": {
        "dataType": "refObject",
        "properties": {
            "csrfToken": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LoginResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"enum","enums":["success"],"required":true},
            "user": {"ref":"PublicUser","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Express.User": {
        "dataType": "refObject",
        "properties": {
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LogoutResponse": {
        "dataType": "refObject",
        "properties": {
            "isAuth": {"dataType":"boolean","required":true},
            "user": {"dataType":"union","subSchemas":[{"ref":"Express.User"},{"dataType":"undefined"}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "GitAccountBody": {
        "dataType": "refObject",
        "properties": {
            "username": {"dataType":"string"},
            "id": {"dataType":"string"},
            "gitAccount": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CreateUserResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"string","required":true},
            "username": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CreateUserBody": {
        "dataType": "refObject",
        "properties": {
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "gitAccount": {"dataType":"string","required":true},
            "admin": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


    
        const argsUserController_getUsers: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/user',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.getUsers)),

            async function UserController_getUsers(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_getUsers, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'getUsers',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_getUser: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.get('/api/v1/user/:id',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.getUser)),

            async function UserController_getUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_getUser, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'getUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_getSshKeyFingerprints: Record<string, TsoaRoute.ParameterSchema> = {
                username: {"in":"path","name":"username","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                authRequiredResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                serverErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.get('/api/v1/user/:username/ssh-key-fingerprints',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.getSshKeyFingerprints)),

            async function UserController_getSshKeyFingerprints(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_getSshKeyFingerprints, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'getSshKeyFingerprints',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_addSshKey: Record<string, TsoaRoute.ParameterSchema> = {
                username: {"in":"path","name":"username","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"AddSSHKeyBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                authRequiredResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                badRequestResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                conflictResponse: {"in":"res","name":"409","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                serverErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/user/:username/ssh-keys',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.addSshKey)),

            async function UserController_addSshKey(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_addSshKey, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'addSshKey',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_removeSshKey: Record<string, TsoaRoute.ParameterSchema> = {
                username: {"in":"path","name":"username","required":true,"dataType":"string"},
                fingerprint: {"in":"path","name":"fingerprint","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                authRequiredResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
                serverErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.delete('/api/v1/user/:username/ssh-keys/:fingerprint',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.removeSshKey)),

            async function UserController_removeSshKey(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_removeSshKey, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'removeSshKey',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_getRepos: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/v1/repo',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.getRepos)),

            async function RepoController_getRepos(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_getRepos, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'getRepos',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_getRepo: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.get('/api/v1/repo/:id',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.getRepo)),

            async function RepoController_getRepo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_getRepo, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'getRepo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_createRepo: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"CreateRepoBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                validationErrorResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                conflictResponse: {"in":"res","name":"409","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                internalServerErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/repo',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.createRepo)),

            async function RepoController_createRepo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_createRepo, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'createRepo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_addPushUser: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"UsernameBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                userNotFoundResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.patch('/api/v1/repo/:id/user/push',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.addPushUser)),

            async function RepoController_addPushUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_addPushUser, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'addPushUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_addAuthoriseUser: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"UsernameBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                userNotFoundResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.patch('/api/v1/repo/:id/user/authorise',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.addAuthoriseUser)),

            async function RepoController_addAuthoriseUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_addAuthoriseUser, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'addAuthoriseUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_removeAuthoriseUser: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                username: {"in":"path","name":"username","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                userNotFoundResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.delete('/api/v1/repo/:id/user/authorise/:username',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.removeAuthoriseUser)),

            async function RepoController_removeAuthoriseUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_removeAuthoriseUser, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'removeAuthoriseUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_removePushUser: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                username: {"in":"path","name":"username","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                userNotFoundResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true}}},
        };
        app.delete('/api/v1/repo/:id/user/push/:username',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.removePushUser)),

            async function RepoController_removePushUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_removePushUser, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'removePushUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsRepoController_deleteRepo: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.delete('/api/v1/repo/:id/delete',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(RepoController)),
            ...(fetchMiddlewares<RequestHandler>(RepoController.prototype.deleteRepo)),

            async function RepoController_deleteRepo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsRepoController_deleteRepo, request, response });

                const controller = new RepoController();

              await templateService.apiHandler({
                methodName: 'deleteRepo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPushController_getPushes: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/v1/push',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PushController)),
            ...(fetchMiddlewares<RequestHandler>(PushController.prototype.getPushes)),

            async function PushController_getPushes(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPushController_getPushes, request, response });

                const controller = new PushController();

              await templateService.apiHandler({
                methodName: 'getPushes',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPushController_getPush: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.get('/api/v1/push/:id',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PushController)),
            ...(fetchMiddlewares<RequestHandler>(PushController.prototype.getPush)),

            async function PushController_getPush(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPushController_getPush, request, response });

                const controller = new PushController();

              await templateService.apiHandler({
                methodName: 'getPush',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPushController_rejectPush: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"RejectBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                validationErrorResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/push/:id/reject',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PushController)),
            ...(fetchMiddlewares<RequestHandler>(PushController.prototype.rejectPush)),

            async function PushController_rejectPush(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPushController_rejectPush, request, response });

                const controller = new PushController();

              await templateService.apiHandler({
                methodName: 'rejectPush',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPushController_authorisePush: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                body: {"in":"body","name":"body","required":true,"ref":"AuthoriseBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                validationErrorResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/push/:id/authorise',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PushController)),
            ...(fetchMiddlewares<RequestHandler>(PushController.prototype.authorisePush)),

            async function PushController_authorisePush(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPushController_authorisePush, request, response });

                const controller = new PushController();

              await templateService.apiHandler({
                methodName: 'authorisePush',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPushController_cancelPush: Record<string, TsoaRoute.ParameterSchema> = {
                id: {"in":"path","name":"id","required":true,"dataType":"string"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/v1/push/:id/cancel',
            authenticateMiddleware([{"jwt":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PushController)),
            ...(fetchMiddlewares<RequestHandler>(PushController.prototype.cancelPush)),

            async function PushController_cancelPush(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPushController_cancelPush, request, response });

                const controller = new PushController();

              await templateService.apiHandler({
                methodName: 'cancelPush',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHomeController_getResources: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api',
            ...(fetchMiddlewares<RequestHandler>(HomeController)),
            ...(fetchMiddlewares<RequestHandler>(HomeController.prototype.getResources)),

            async function HomeController_getResources(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHomeController_getResources, request, response });

                const controller = new HomeController();

              await templateService.apiHandler({
                methodName: 'getResources',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHealthController_check: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/healthcheck',
            ...(fetchMiddlewares<RequestHandler>(HealthController)),
            ...(fetchMiddlewares<RequestHandler>(HealthController.prototype.check)),

            async function HealthController_check(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHealthController_check, request, response });

                const controller = new HealthController();

              await templateService.apiHandler({
                methodName: 'check',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsConfigController_getAttestation: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/config/attestation',
            ...(fetchMiddlewares<RequestHandler>(ConfigController)),
            ...(fetchMiddlewares<RequestHandler>(ConfigController.prototype.getAttestation)),

            async function ConfigController_getAttestation(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsConfigController_getAttestation, request, response });

                const controller = new ConfigController();

              await templateService.apiHandler({
                methodName: 'getAttestation',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsConfigController_getUrlShortener: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/config/urlShortener',
            ...(fetchMiddlewares<RequestHandler>(ConfigController)),
            ...(fetchMiddlewares<RequestHandler>(ConfigController.prototype.getUrlShortener)),

            async function ConfigController_getUrlShortener(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsConfigController_getUrlShortener, request, response });

                const controller = new ConfigController();

              await templateService.apiHandler({
                methodName: 'getUrlShortener',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsConfigController_getContactEmail: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/config/contactEmail',
            ...(fetchMiddlewares<RequestHandler>(ConfigController)),
            ...(fetchMiddlewares<RequestHandler>(ConfigController.prototype.getContactEmail)),

            async function ConfigController_getContactEmail(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsConfigController_getContactEmail, request, response });

                const controller = new ConfigController();

              await templateService.apiHandler({
                methodName: 'getContactEmail',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsConfigController_getUiRouteAuth: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/config/uiRouteAuth',
            ...(fetchMiddlewares<RequestHandler>(ConfigController)),
            ...(fetchMiddlewares<RequestHandler>(ConfigController.prototype.getUiRouteAuth)),

            async function ConfigController_getUiRouteAuth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsConfigController_getUiRouteAuth, request, response });

                const controller = new ConfigController();

              await templateService.apiHandler({
                methodName: 'getUiRouteAuth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsConfigController_getSSH: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/v1/config/ssh',
            ...(fetchMiddlewares<RequestHandler>(ConfigController)),
            ...(fetchMiddlewares<RequestHandler>(ConfigController.prototype.getSSH)),

            async function ConfigController_getSSH(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsConfigController_getSSH, request, response });

                const controller = new ConfigController();

              await templateService.apiHandler({
                methodName: 'getSSH',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_getResources: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/auth',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.getResources)),

            async function AuthController_getResources(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_getResources, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'getResources',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_getAuthConfig: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/auth/config',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.getAuthConfig)),

            async function AuthController_getAuthConfig(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_getAuthConfig, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'getAuthConfig',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_getCsrfToken: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.get('/api/auth/csrf-token',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.getCsrfToken)),

            async function AuthController_getCsrfToken(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_getCsrfToken, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'getCsrfToken',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_login: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.post('/api/auth/login',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.login)),

            async function AuthController_login(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_login, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'login',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_initiateOIDC: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/auth/openidconnect',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.initiateOIDC)),

            async function AuthController_initiateOIDC(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_initiateOIDC, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'initiateOIDC',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_handleOIDCCallback: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/api/auth/openidconnect/callback',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.handleOIDCCallback)),

            async function AuthController_handleOIDCCallback(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_handleOIDCCallback, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'handleOIDCCallback',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_logout: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
        };
        app.post('/api/auth/logout',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.logout)),

            async function AuthController_logout(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_logout, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'logout',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_getProfile: Record<string, TsoaRoute.ParameterSchema> = {
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.get('/api/auth/profile',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.getProfile)),

            async function AuthController_getProfile(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_getProfile, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'getProfile',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_updateGitAccount: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"GitAccountBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"401","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                notFoundResponse: {"in":"res","name":"404","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                validationErrorResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                forbiddenResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                internalServerErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/auth/gitAccount',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.updateGitAccount)),

            async function AuthController_updateGitAccount(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_updateGitAccount, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'updateGitAccount',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsAuthController_createUser: Record<string, TsoaRoute.ParameterSchema> = {
                body: {"in":"body","name":"body","required":true,"ref":"CreateUserBody"},
                req: {"in":"request","name":"req","required":true,"dataType":"object"},
                unauthorisedResponse: {"in":"res","name":"403","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                validationErrorResponse: {"in":"res","name":"400","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
                internalServerErrorResponse: {"in":"res","name":"500","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"message":{"dataType":"string","required":true}}},
        };
        app.post('/api/auth/create-user',
            ...(fetchMiddlewares<RequestHandler>(AuthController)),
            ...(fetchMiddlewares<RequestHandler>(AuthController.prototype.createUser)),

            async function AuthController_createUser(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsAuthController_createUser, request, response });

                const controller = new AuthController();

              await templateService.apiHandler({
                methodName: 'createUser',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
        return async function runAuthenticationMiddleware(request: any, response: any, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            // keep track of failed auth attempts so we can hand back the most
            // recent one.  This behavior was previously existing so preserving it
            // here
            const failedAttempts: any[] = [];
            const pushAndRethrow = (error: any) => {
                failedAttempts.push(error);
                throw error;
            };

            const secMethodOrPromises: Promise<any>[] = [];
            for (const secMethod of security) {
                if (Object.keys(secMethod).length > 1) {
                    const secMethodAndPromises: Promise<any>[] = [];

                    for (const name in secMethod) {
                        secMethodAndPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }

                    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

                    secMethodOrPromises.push(Promise.all(secMethodAndPromises)
                        .then(users => { return users[0]; }));
                } else {
                    for (const name in secMethod) {
                        secMethodOrPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }
                }
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            try {
                request['user'] = await Promise.any(secMethodOrPromises);

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }

                next();
            }
            catch(err) {
                // Show most recent error as response
                const error = failedAttempts.pop();
                error.status = error.status || 401;

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }
                next(error);
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        }
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
