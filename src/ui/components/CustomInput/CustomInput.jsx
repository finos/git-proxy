import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Input from '@mui/material/Input';
import { Clear, Check } from '@mui/icons-material';
import styles from '../../assets/jss/material-dashboard-react/components/customInputStyle';

const useStyles = makeStyles(styles);

export default function CustomInput(props) {
  const classes = useStyles();
  const { formControlProps, labelText, id, labelProps, inputProps, error, success } = props;

  const labelClasses = classNames({
    [' ' + classes.labelRootError]: error,
    [' ' + classes.labelRootSuccess]: success && !error,
  });
  const underlineClasses = classNames({
    [classes.underlineError]: error,
    [classes.underlineSuccess]: success && !error,
    [classes.underline]: true,
  });
  const marginTop = classNames({
    [classes.marginTop]: labelText === undefined,
  });

  const generateIcon = () => {
    if (error) {
      return <Clear className={classes.feedback + ' ' + classes.labelRootError} />;
    }
    if (success) {
      return <Check className={classes.feedback + ' ' + classes.labelRootSuccess} />;
    }
    return null;
  };

  return (
    <FormControl
      {...formControlProps}
      className={formControlProps.className + ' ' + classes.formControl}
    >
      {labelText !== undefined ? (
        <InputLabel className={classes.labelRoot + labelClasses} htmlFor={id} {...labelProps}>
          {labelText}
        </InputLabel>
      ) : null}
      <Input
        classes={{
          root: marginTop,
          disabled: classes.disabled,
          underline: underlineClasses,
        }}
        id={id}
        {...inputProps}
      />
      {generateIcon()}
    </FormControl>
  );
}

CustomInput.propTypes = {
  labelText: PropTypes.node,
  labelProps: PropTypes.object,
  id: PropTypes.string,
  inputProps: PropTypes.object,
  formControlProps: PropTypes.object,
  error: PropTypes.bool,
  success: PropTypes.bool,
};
