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

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { getAxiosConfig } from '../services/auth';
import { getBaseUrl, getApiV1BaseUrl } from '../services/apiConfig';
import { userQueryKeys } from './userQueryKeys';
import { PublicUser } from '../../db/types';

async function fetchUser(id: string | null | undefined): Promise<PublicUser> {
  const baseUrl = await getBaseUrl();
  const apiV1BaseUrl = await getApiV1BaseUrl();
  const url = id ? `${apiV1BaseUrl}/user/${encodeURIComponent(id)}` : `${baseUrl}/api/auth/profile`;
  const response = await axios<PublicUser>(url, getAxiosConfig());
  return response.data;
}

export function useUserQuery(id: string | null | undefined) {
  const navigate = useNavigate();
  const queryKey = userQueryKeys.detail(id ?? 'profile');

  return useQuery<PublicUser>({
    queryKey,
    queryFn: async () => {
      try {
        return await fetchUser(id);
      } catch (error: unknown) {
        const status = (error as any)?.response?.status;
        if (status === 401) {
          navigate('/login', { replace: true });
        }
        throw error;
      }
    },
  });
}
