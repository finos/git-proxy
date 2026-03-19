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

import React from 'react';
import moment from 'moment';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { generateEmailLink } from '../../../utils';
import { CommitData } from '../../../../proxy/processors/types';

interface CommitDataTableProps {
  commitData: CommitData[];
}

const CommitDataTable: React.FC<CommitDataTableProps> = ({ commitData }) => {
  if (commitData.length === 0) {
    return <p>No commits found for this push.</p>;
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Timestamp</TableCell>
          <TableCell>Committer</TableCell>
          <TableCell>Author</TableCell>
          <TableCell>Message</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {commitData.map((c) => (
          <TableRow key={c.commitTimestamp}>
            <TableCell>{moment.unix(Number(c.commitTimestamp || 0)).toString()}</TableCell>
            <TableCell>{generateEmailLink(c.committer, c.committerEmail)}</TableCell>
            <TableCell>{generateEmailLink(c.author, c.authorEmail)}</TableCell>
            <TableCell>{c.message}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CommitDataTable;
