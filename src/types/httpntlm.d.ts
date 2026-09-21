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

// Type declarations for the `httpntlm/ntlm` submodule, which exposes
// low-level NTLMSSP message build/parse helpers. The package ships no
// declarations of its own. We only declare the surface we actually use.

declare module 'httpntlm/ntlm' {
  /**
   * Opaque object returned by `parseType2Message`. Carries the parsed
   * server challenge and target info. Pass it back to `createType3Message`.
   */
  export interface Type2Message {
    signature: string;
    type: number;
    targetName: string;
    targetNameLen: number;
    targetNameMaxLen: number;
    targetNameOffset: number;
    negotiateFlags: number;
    serverChallenge: Buffer;
    reserved: Buffer;
    [property: string]: unknown;
  }

  /** Returns the value to send as `Proxy-Authorization` (already prefixed with `NTLM `). */
  export function createType1Message(opts: { workstation?: string; domain?: string }): string;

  /** Parses a `Proxy-Authenticate: NTLM <base64>` value into a Type2Message. */
  export function parseType2Message(header: string): Type2Message;

  /** Returns the value to send as `Proxy-Authorization` (already prefixed with `NTLM `). */
  export function createType3Message(
    type2: Type2Message,
    opts: {
      username: string;
      password: string;
      workstation?: string;
      domain?: string;
    },
  ): string;
}
