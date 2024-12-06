import React from 'react';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';

export default function License(props) {
  const { data } = props;

  return (
    <div
      style={{
        width: '100%',
        background: '#EEEAEA',
        borderRadius: '15px',
        color: 'black',
        marginTop: 15,
        marginBottom: 15,
      }}
    >
      <GridContainer>
        <GridItem xs={12} sm={6}>
          <div style={{ margin: 25 }}>
            <h4 style={{ fontWeight: 'bold' }}>
              <a href={`/admin/license/${data.spdx_id}`}>{data.full_name}</a>
            </h4>
            <p>{data.description}</p>
          </div>
        </GridItem>
        <GridItem xs={0} sm={6}>
          <div style={{ margin: 25 }}>
            <GridContainer>
              <GridItem xs={4}>
                <b>Permissions</b>
                <ul style={{ padding: 0, listStyleType: 'none', fontSize: '14px' }}>
                  {data.commercial_use ? <li>Commercial use</li> : null}
                  {data.modification ? <li>Modification</li> : null}
                  {data.distribution ? <li>Distribution</li> : null}
                  {data.patent_use ? <li>Patent use</li> : null}
                  {data.private_use ? <li>Private Use</li> : null}
                </ul>
              </GridItem>
              <GridItem xs={4}>
                <b>Limitations</b>
                <ul style={{ padding: 0, listStyleType: 'none', fontSize: '14px' }}>
                  {!data.trademark_use ? <li> Trademark use</li> : null}
                  {!data.liability ? <li>Liability</li> : null}
                  {!data.warranty ? <li>Warranty</li> : null}
                </ul>
              </GridItem>
              <GridItem xs={4}>
                <b>Conditions</b>
                <ul style={{ padding: 0, listStyleType: 'none', fontSize: '14px' }}>
                  <li>License and copyright notice</li>
                  <li>State changes</li>
                </ul>
              </GridItem>
            </GridContainer>
          </div>
        </GridItem>
      </GridContainer>
    </div>
  );
}
