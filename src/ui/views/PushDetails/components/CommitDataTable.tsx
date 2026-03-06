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
