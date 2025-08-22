import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import Clear from '@material-ui/icons/Clear';
import Check from '@material-ui/icons/Check';
import styles from '../../assets/jss/material-dashboard-react/components/customInputStyle';

const useStyles = makeStyles(styles);

export default function CustomInput(props) {
  const classes = useStyles();
  const { formControlProps, labelText, id, labelProps, inputProps, error, success } = props;

  const labelClasses = clsx({
    [classes.labelRootError]: error,
    [classes.labelRootSuccess]: success && !error,
  });
  const underlineClasses = clsx({
    [classes.underlineError]: error,
    [classes.underlineSuccess]: success && !error,
    [classes.underline]: true,
  });
  const marginTop = clsx({
    [classes.marginTop]: labelText === undefined,
  });

  const generateIcon = () => {
    if (error) {
      return <Clear className={clsx(classes.feedback, classes.labelRootError)} />;
    }
    if (success) {
      return <Check className={clsx(classes.feedback, classes.labelRootSuccess)} />;
    }
    return null;
  };

  return (
    <FormControl
      {...formControlProps}
      className={clsx(formControlProps.className, classes.formControl)}
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
