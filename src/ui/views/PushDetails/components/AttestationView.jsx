import React, { useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import { CheckCircle } from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import moment from 'moment';

import Checkbox from '@mui/material/Checkbox';
import withStyles from '@mui/styles/withStyles';
import { green } from '@mui/material/colors';

import { getURLShortener } from '../../../services/config';

const GreenCheckbox = withStyles({
  root: {
    color: green[500],
    '&$checked': {
      color: green[700],
    },
    paddingRight: '35px',
  },
  checked: {},
})((props) => <Checkbox color='default' {...props} />);

export default function AttestationView(props) {
  const [urlShortener, setURLShortener] = React.useState('');

  useEffect(() => {
    if (props.attestation && !urlShortener) {
      getURLShortener(setURLShortener);
    }
  }, [props.attestation]);

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      open={props.attestation}
      onClose={() => props.setAttestation(false)}
      aria-labelledby='alert-dialog-title'
      aria-describedby='alert-dialog-description'
      style={{ margin: '0px 15px 0px 15px' }}
    >
      <span
        style={{
          background: '#eeeeee',
          borderRadius: '10px',
          margin: '24px 24px',
          padding: '24px 24px',
        }}
        color='warning'
      >
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <CheckCircle fontSize='medium' htmlColor='black'></CheckCircle>
          <span style={{ fontSize: '16px', paddingLeft: '10px', fontWeight: 'bold' }}>
            What does it mean for a code contribution to be approved?
          </span>
        </div>
        <p style={{ fontSize: '15px', paddingLeft: '34px' }}>
          Prior to making this code contribution publicly accessible via GitHub, this code
          contribution was reviewed and approved by{' '}
          <a href={`/admin/user/${props.data.reviewer.username}`}>
            {props.data.reviewer.gitAccount}
          </a>
          . As a reviewer, it was their responsibility to confirm that open sourcing this
          contribution followed the requirements of the company open source contribution policy.
        </p>
      </span>
      <DialogContent>
        <p>
          <span>
            <a href={`/admin/user/${props.data.reviewer.username}`}>
              {props.data.reviewer.gitAccount}
            </a>{' '}
            approved this contribution{' '}
            <Tooltip
              title={moment(props.data.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')}
              arrow
            >
              <kbd
                style={{
                  float: 'right',
                }}
              >
                {moment(props.data.timestamp).fromNow()}
              </kbd>
            </Tooltip>{' '}
            and confirmed that:
          </span>
        </p>

        <FormGroup
          style={{ margin: '0px 15px 0px 35px', rowGap: '20px', padding: '20px' }}
          row={false}
        >
          {props.data.questions.map((question, index) => {
            return (
              <div key={index}>
                <FormControlLabel
                  style={{
                    root: {
                      color: 'white',
                      '&$disabled': {
                        color: 'white',
                      },
                    },
                    disabled: {},
                  }}
                  control={<GreenCheckbox checked={question.checked} />}
                  disabled={true}
                  label={question.label}
                />
              </div>
            );
          })}
        </FormGroup>
      </DialogContent>
      <DialogActions></DialogActions>
    </Dialog>
  );
}
