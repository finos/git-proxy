import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import LicenseCard from '../LicenseList/Components/LicenseCard';

const license = {
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
};

export default function LicenseDetails(props) {
  return (
    <GridContainer>
      <GridItem>
        <LicenseCard data={license} />
      </GridItem>
      <GridItem sx={12}>
        <h4>Audit History</h4>
      </GridItem>
    </GridContainer>
  );
}
