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

import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import Chip from '@material-ui/core/Chip';
import Box from '@material-ui/core/Box';
import { StepData } from '../../../../proxy/actions/Step';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  summary: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: '#f5f5f5',
    borderRadius: theme.spacing(1),
  },
  summaryTitle: {
    marginTop: 0,
    marginBottom: theme.spacing(1),
  },
  summaryStats: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  timeline: {
    position: 'relative',
    paddingLeft: theme.spacing(4),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: '19px',
      top: '20px',
      bottom: '20px',
      width: '2px',
      backgroundColor: '#e0e0e0',
    },
  },
  stepAccordion: {
    marginBottom: theme.spacing(2),
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    '&::before': {
      display: 'none',
    },
  },
  stepSummary: {
    minHeight: '56px !important',
    '& .MuiAccordionSummary-content': {
      alignItems: 'center',
      margin: '12px 0',
    },
  },
  stepIcon: {
    position: 'absolute',
    left: '-28px',
    backgroundColor: 'white',
    borderRadius: '50%',
    padding: '2px',
    zIndex: 1,
  },
  stepContent: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flex: 1,
  },
  stepName: {
    fontWeight: 500,
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  stepDetails: {
    display: 'block',
    padding: theme.spacing(2),
    backgroundColor: '#fafafa',
  },
  messageBox: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    borderRadius: theme.spacing(0.5),
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a',
  },
  blockedMessage: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    border: '1px solid #ffb74d',
  },
  logsContainer: {
    marginTop: theme.spacing(1),
  },
  logsTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
  },
  logItem: {
    padding: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    backgroundColor: '#f5f5f5',
    borderLeft: '3px solid #9e9e9e',
    fontFamily: 'monospace',
    fontSize: '12px',
    wordBreak: 'break-word',
  },
}));

interface StepsTimelineProps {
  steps: StepData[];
}

const StepsTimeline: React.FC<StepsTimelineProps> = ({ steps }) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState<string | false>(
    () => steps.find((s) => s.error)?.id ?? false,
  );

  const isLargeStep = (stepName: string) => stepName === 'writePack' || stepName === 'diff';

  const handleChange =
    (panel: string, stepName: string) =>
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    (event: React.ChangeEvent<{}>, isExpanded: boolean) => {
      if (isLargeStep(stepName)) {
        return;
      }
      setExpanded(isExpanded ? panel : false);
    };

  const getStepIcon = (step: StepData) => {
    if (step.error) {
      return <ErrorIcon style={{ color: '#d32f2f', fontSize: '24px' }} />;
    }
    if (step.blocked) {
      return <WarningIcon style={{ color: '#f57c00', fontSize: '24px' }} />;
    }
    return <CheckCircleIcon style={{ color: '#388e3c', fontSize: '24px' }} />;
  };

  const getStepStatus = (step: StepData) => {
    if (step.error) {
      return (
        <Chip label='Error' size='small' style={{ backgroundColor: '#d32f2f', color: 'white' }} />
      );
    }
    if (step.blocked) {
      return (
        <Chip label='Blocked' size='small' style={{ backgroundColor: '#f57c00', color: 'white' }} />
      );
    }
    return (
      <Chip label='Success' size='small' style={{ backgroundColor: '#388e3c', color: 'white' }} />
    );
  };

  const totalSteps = steps.length;
  const errorSteps = steps.filter((s) => s.error).length;
  const blockedSteps = steps.filter((s) => s.blocked).length;
  const successSteps = totalSteps - errorSteps - blockedSteps;

  return (
    <div className={classes.root}>
      <Box className={classes.summary}>
        <h3 className={classes.summaryTitle}>Push Validation Steps Summary</h3>
        <div className={classes.summaryStats}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${successSteps} Successful`}
            style={{ backgroundColor: '#388e3c', color: 'white' }}
          />
          {errorSteps > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${errorSteps} Error${errorSteps > 1 ? 's' : ''}`}
              style={{ backgroundColor: '#d32f2f', color: 'white' }}
            />
          )}
          {blockedSteps > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${blockedSteps} Blocked`}
              style={{ backgroundColor: '#f57c00', color: 'white' }}
            />
          )}
          <Chip label={`${totalSteps} Total Steps`} variant='outlined' />
        </div>
      </Box>

      <div className={classes.timeline}>
        {steps.map((step) => (
          <Accordion
            key={step.id}
            id={step.stepName === 'ai-scanner' ? 'ai-scanner-step' : undefined}
            expanded={expanded === step.id}
            onChange={handleChange(step.id, step.stepName)}
            className={classes.stepAccordion}
            disabled={isLargeStep(step.stepName)}
          >
            <AccordionSummary
              expandIcon={isLargeStep(step.stepName) ? null : <ExpandMoreIcon />}
              className={classes.stepSummary}
            >
              <div className={classes.stepIcon}>{getStepIcon(step)}</div>
              <div className={classes.stepContent}>
                <Typography className={classes.stepName} data-testid={`step-name-${step.stepName}`}>
                  {step.stepName}
                </Typography>
                {getStepStatus(step)}
              </div>
            </AccordionSummary>
            <AccordionDetails
              className={classes.stepDetails}
              data-testid={`step-details-${step.stepName}`}
            >
              <div>
                {step.error && step.errorMessage && (
                  <div className={`${classes.messageBox} ${classes.errorMessage}`}>
                    <strong>Error:</strong> {step.errorMessage}
                  </div>
                )}
                {step.blocked && step.blockedMessage && (
                  <div className={`${classes.messageBox} ${classes.blockedMessage}`}>
                    <strong>Blocked:</strong> {step.blockedMessage}
                  </div>
                )}
                {step.content && (
                  <div style={{ marginBottom: '16px' }}>
                    <Typography
                      variant='subtitle2'
                      style={{ fontWeight: 'bold', marginBottom: '8px' }}
                    >
                      Content:
                    </Typography>
                    <pre
                      style={{
                        padding: '12px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {typeof step.content === 'string'
                        ? step.content
                        : JSON.stringify(step.content, null, 2)}
                    </pre>
                  </div>
                )}
                {step.logs && step.logs.length > 0 && (
                  <div className={classes.logsContainer}>
                    <Typography variant='subtitle2' className={classes.logsTitle}>
                      Logs ({step.logs.length}):
                    </Typography>
                    {step.logs.map((log: string, logIndex: number) => (
                      <div key={logIndex} className={classes.logItem}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
                {!step.error &&
                  !step.blocked &&
                  !step.content &&
                  (!step.logs || step.logs.length === 0) && (
                    <Typography variant='body2' style={{ color: '#666', fontStyle: 'italic' }}>
                      This step completed successfully with no additional details.
                    </Typography>
                  )}
              </div>
            </AccordionDetails>
          </Accordion>
        ))}
      </div>
    </div>
  );
};

export default StepsTimeline;
