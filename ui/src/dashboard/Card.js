import clsx from 'clsx';
import React from 'react';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Title from './Title';


const useStyles = makeStyles((theme) => ({

  paper: {
    padding: theme.spacing(2),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
  },
  fixedHeight: {
    height: 120,
  },

}));


export default function Card(props) {
  const classes = useStyles();
  const fixedHeightPaper = clsx(classes.paper, classes.fixedHeight);

  const {text, title} = props;

  return (
    <React.Fragment>
      <Paper className={fixedHeightPaper}>
        <Title>{title}</Title>
        <Typography component="p" >
        {text}
        </Typography>
      </Paper>
    </React.Fragment>
  );
}