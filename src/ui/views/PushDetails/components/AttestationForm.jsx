import React from 'react';
import withStyles from '@mui/styles/withStyles';
import { green } from '@mui/material/colors';
import { Help } from '@mui/icons-material';
import { Grid, Tooltip, Checkbox, FormGroup, FormControlLabel } from '@mui/material';

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

const HTMLTooltip = withStyles((theme) => ({
  tooltip: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: '1px solid #dadde9',
  },
}))(Tooltip);

export default function AttestationForm(props) {
  const handleChange = (event) => {
    const name = event.target.name;
    const checked = event.target.checked;
    const clone = [...props.formData];
    clone[name] = { ...clone[name], checked };
    props.passFormData(clone);
  };

  return (
    <FormGroup style={{ margin: '0px 15px 0px 35px', rowGap: '20px', padding: '20px' }} row={false}>
      {props.formData.map((question, index) => {
        return (
          <Grid key={index} container spacing={2} direction='row' alignItems='center'>
            <Grid item xs={11}>
              <FormControlLabel
                control={
                  <GreenCheckbox checked={question.checked} onChange={handleChange} name={index} />
                }
                label={question.label}
              />
            </Grid>
            <Grid item xs={1}>
              <HTMLTooltip
                interactive
                placement='left'
                title={
                  <React.Fragment>
                    {question.tooltip.text}
                    {question.tooltip.links && (
                      <div>
                        <ul style={{ padding: 0, listStyleType: 'none' }}>
                          {question.tooltip.links.map((link, linkIndex) => {
                            return (
                              <li key={linkIndex}>
                                <a target='_blank' href={link.url} rel='noreferrer'>
                                  {link.text}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </React.Fragment>
                }
              >
                <Help style={{ cursor: 'help' }} fontSize='small' htmlColor='#87a2bd'></Help>
              </HTMLTooltip>
            </Grid>
          </Grid>
        );
      })}
    </FormGroup>
  );
}
