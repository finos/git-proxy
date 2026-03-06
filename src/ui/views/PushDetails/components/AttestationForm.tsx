import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import { green } from '@material-ui/core/colors';
import { Help } from '@material-ui/icons';
import { Grid, Tooltip, Checkbox, FormGroup, FormControlLabel } from '@material-ui/core';
import { Theme } from '@material-ui/core/styles';
import { QuestionFormData } from '../../../types';

interface AttestationFormProps {
  formData: QuestionFormData[];
  passFormData: (data: QuestionFormData[]) => void;
}

const styles = (theme: Theme) => ({
  tooltip: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: '1px solid #dadde9',
  },
});

interface GreenCheckboxProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
}

const GreenCheckbox = withStyles({
  root: {
    color: green[500],
    '&$checked': {
      color: green[700],
    },
    paddingRight: '35px',
  },
  checked: {},
})((props: GreenCheckboxProps) => <Checkbox color='default' {...props} />);

const HTMLTooltip = withStyles(styles)(Tooltip);

const AttestationForm: React.FC<AttestationFormProps> = ({ formData, passFormData }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = parseInt(event.target.name);
    const checked = event.target.checked;
    const clone = [...formData];
    clone[name] = { ...clone[name], checked };
    passFormData(clone);
  };

  return (
    <FormGroup style={{ margin: '0px 15px 0px 35px', rowGap: '20px', padding: '20px' }} row={false}>
      {formData.map((question, index) => {
        return (
          <Grid key={index} container spacing={2} direction='row' alignItems='center'>
            <Grid item xs={11}>
              <FormControlLabel
                control={
                  <GreenCheckbox
                    checked={question.checked}
                    onChange={handleChange}
                    name={index.toString()}
                  />
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
                <Help style={{ cursor: 'help' }} fontSize='small' htmlColor='#87a2bd' />
              </HTMLTooltip>
            </Grid>
          </Grid>
        );
      })}
    </FormGroup>
  );
};

export default AttestationForm;
