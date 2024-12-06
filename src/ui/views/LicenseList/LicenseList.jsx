import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import LicenseCard from './Components/LicenseCard';
import { CheckCircleFillIcon } from '@primer/octicons-react';

const licenses = [
  {
    spdx_id: 'Apache-2.0',
    status: 'approved',
    full_name: 'Apache License 2.0',
    description:
      'A permissive license whose main conditions require preservation of copyright and license notices. Contributors provide an express grant of patent rights. Licensed works, modifications, and larger works may be distributed under different terms and without source code.',
    commercial_use: true,
    modification: true,
    distribution: true,
    patent_use: true,
    private_use: true,
    trademark_use: false,
    liability: false,
    warranty: false,
  },
  {
    spdx_id: 'MIT',
    status: 'approved',
    full_name: 'MIT License',
    description:
      'A short and simple permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code.',
    commercial_use: true,
    modification: true,
    distribution: true,
    patent_use: false,
    private_use: true,
    trademark_use: true,
    liability: false,
    warranty: false,
  },
  {
    spdx_id: '0BSD',
    status: 'approved',
    full_name: 'BSD Zero Clause License',
    description:
      'A short and simple permissive license with conditions only requiring preservation of copyright and license notices. Licensed works, modifications, and larger works may be distributed under different terms and without source code.',
    commercial_use: true,
    modification: true,
    distribution: true,
    patent_use: false,
    private_use: true,
    trademark_use: true,
    liability: false,
    warranty: false,
  },
];

export default function LicenseList() {
  return (
    <GridContainer>
      <GridItem sx={12}>
        <h4>
          <span style={{ color: 'green' }}>
            <CheckCircleFillIcon size={24} />
          </span>{' '}
          Approved
        </h4>
      </GridItem>
      {licenses
        .filter((license) => license.status === 'approved')
        .map((license) => {
          return (
            <GridItem key={license.spdx_id} xs={12} sm={12} md={12}>
              <LicenseCard data={license} key={license.spdx_id} />
            </GridItem>
          );
        })}
    </GridContainer>
  );
}
