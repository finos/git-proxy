import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';
import { useParams } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';

import Button from '@material-ui/core/Button';

import Icon from '@material-ui/core/Icon';
import SaveIcon from '@material-ui/icons/Save';

import TextField from '@material-ui/core/TextField';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Collapse from '@material-ui/core/Collapse';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import { red } from '@material-ui/core/colors';
import FavoriteIcon from '@material-ui/icons/Favorite';
import ShareIcon from '@material-ui/icons/Share';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import DeleteIcon from '@material-ui/icons/Delete';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import Title from './Title';


import { Divider } from '@material-ui/core';
import Diff from './Diff'



const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(1),
      width: '25ch',
    },
  },
  seeMore: {
    marginTop: theme.spacing(3),
  },
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


export default function PushDetails() {
  const { id } = useParams();
  const classes = useStyles();
  const fixedHeightPaper = clsx(classes.paper, classes.fixedHeight);
  const [hasError, setErrors] = useState(false);
  const [push, setPush] = useState([]);
  
  async function fetchData() {
    const url = `http://localhost:8080/api/v1/pushes/${id}`;
    await fetch(url)
      .then(res => res.json())
      .then(res => {              
        res.diff = res.steps.find(x => x.stepName === 'diff');
        console.log(res);
        setPush(res)

      })
      .catch(err => setErrors(err));
  }

  async function authorise() {
    const url = `http://localhost:8080/api/v1/auth/${id}`;
    console.log(url)
    await fetch(url)
      .then(x => x.json())
      .then(x => {              
        console.log("AUTH");
        console.log(x);
      })
      .catch(err => setErrors(err));
  }
  
  useEffect(() => {
    fetchData();
  }, []);

  if (push.length === 0) {
    return <div><h3>Loading</h3></div>
  }
    
  return (

    <React.Fragment>
      <Title>Push Details</Title>
      <Divider />
      <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary'>
        <a href='/'>Back..</a>
      </Typography>
      <Divider />
      <br/>
      <Grid container spacing={2}>                    
          
          <Grid item xs={2} md={2} lg={2}>
            <Typography variant="h6" gutterBottom align='left' color='primary'>
              AUTHOR
            </Typography>
            <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary'>
              pGrovesy
            </Typography>                      
          </Grid>                      
          <Grid item xs={2} md={2} lg={2}>
            <Typography variant="h6" gutterBottom align='left' color='primary' >
              PROJECT
            </Typography>
            <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary'>
              {push.project}
            </Typography>                      
          </Grid>
          
          <Grid item xs={2} md={2} lg={2}>
            <Typography variant="h6" gutterBottom align='left' color='primary'>
              REPO
            </Typography>
            <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary' >
              {push.repoName}
            </Typography>                      
          </Grid>
          
          <Grid item xs={3} md={3} lg={3}>
            <Typography variant="h6" gutterBottom align='left' color='primary' >
              BRANCH
            </Typography>
            <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary'>
              {push.branch}
            </Typography>                      
          </Grid>
          
          <Grid item xs={3} md={3} lg={3}>
            <Typography variant="h6" gutterBottom align='left' color='primary'>
              COMMIT
            </Typography>
            <Typography variant="subtitle1" gutterBottom align='left' color='textSecondary'>
              {push.commitFrom.substring(0,8)}...{push.commitTo.substring(0,8)}
            </Typography>                      
          </Grid>
        </Grid>
        <Divider />
        <br/>                           
        <Grid container spacing={10}>                                
          <Grid item xs={1} md={1} lg={1}>
            <Button 
              variant="contained"
              color="secondary"              
              startIcon={<DeleteIcon />}>Rject
            </Button>        
          </Grid>
          <Grid item xs={1} md={1} lg={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={authorise}
              className={classes.button}
              startIcon={<CloudUploadIcon />}>Authorise</Button>
          
          </Grid>
        </Grid>
        <br/>
        <Divider />
        <br/>
        <Grid item xs={12} md={12} lg={12}>
          <Diff diff={push.diff.content}/>
        </Grid>        
        
      </React.Fragment>
    
  );
}

