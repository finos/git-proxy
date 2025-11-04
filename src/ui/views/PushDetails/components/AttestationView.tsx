import React, { useEffect } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { CheckCircle } from '@material-ui/icons';
import Tooltip from '@material-ui/core/Tooltip';
import moment from 'moment';
import Checkbox from '@material-ui/core/Checkbox';
import { withStyles } from '@material-ui/core/styles';
import { green } from '@material-ui/core/colors';
import { setURLShortenerData } from '../../../services/config';
import { AttestationViewProps } from '../attestation.types';
import UserLink from '../../../components/UserLink/UserLink';

const StyledFormControlLabel = withStyles({
  root: {
    color: 'white',
    '&$disabled': {
      color: 'white',
    },
  },
  disabled: {},
})(FormControlLabel);

const GreenCheckbox = withStyles({
  root: {
    color: green[500],
    '&$checked': {
      color: green[700],
    },
    paddingRight: '35px',
  },
  checked: {},
})((props: { checked: boolean }) => <Checkbox color='default' {...props} />);

const AttestationView: React.FC<AttestationViewProps> = ({ attestation, setAttestation, data }) => {
  const [urlShortener, setURLShortener] = React.useState<string>('');

  useEffect(() => {
    if (attestation && !urlShortener) {
      setURLShortenerData(setURLShortener);
    }
  }, [attestation, urlShortener]);

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      open={attestation}
      onClose={() => setAttestation(false)}
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
      >
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <CheckCircle fontSize='medium' htmlColor='black' />
          <span style={{ fontSize: '16px', paddingLeft: '10px', fontWeight: 'bold' }}>
            What does it mean for a code contribution to be approved?
          </span>
        </div>
        <p style={{ fontSize: '15px', paddingLeft: '34px' }}>
          Prior to making this code contribution publicly accessible via GitHub, this code
          contribution was reviewed and approved by{' '}
          <UserLink username={data.reviewer.username}>{data.reviewer.gitAccount}</UserLink>. As a
          reviewer, it was their responsibility to confirm that open sourcing this contribution
          followed the requirements of the company open source contribution policy.
        </p>
      </span>
      <DialogContent>
        <p>
          <span>
            <UserLink username={data.reviewer.username}>{data.reviewer.gitAccount}</UserLink>{' '}
            approved this contribution{' '}
            <Tooltip title={moment(data.timestamp).format('dddd, MMMM Do YYYY, h:mm:ss a')} arrow>
              <kbd
                style={{
                  float: 'right',
                }}
              >
                {moment(data.timestamp).fromNow()}
              </kbd>
            </Tooltip>{' '}
            and confirmed that:
          </span>
        </p>

        <FormGroup
          style={{ margin: '0px 15px 0px 35px', rowGap: '20px', padding: '20px' }}
          row={false}
        >
          {data.questions.map((question, index) => (
            <div key={index}>
              <StyledFormControlLabel
                control={<GreenCheckbox checked={question.checked} />}
                disabled={true}
                label={question.label}
              />
            </div>
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions></DialogActions>
    </Dialog>
  );
};

export default AttestationView;
