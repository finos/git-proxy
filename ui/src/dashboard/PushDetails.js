import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';
import { useParams } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';

import Button from '@material-ui/core/Button';




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
      <br/>
      <Grid container spacing={1}>
        <Grid item lg={3}>

        <Card className={classes.root} variant="outlined">
          <CardContent>
            <Typography className={classes.title} color="textSecondary" gutterBottom>
              Word of the Day
            </Typography>
            <Typography variant="h5" component="h2">
              test 123
            </Typography>
            <Typography className={classes.pos} color="textSecondary">
              adjective
            </Typography>
            <Typography variant="body2" component="p">
              well meaning and kindly.
              <br />
              {'"a benevolent smile"'}
            </Typography>
          </CardContent>
          <CardActions>
            <Button onClick={authorise}>Authorise</Button>            
          </CardActions>
        </Card>
      </Grid>
        {/* </Grid>
        <Grid item xs={3} md={3} lg={3}>
          <Card title="Repository" text={push.repoName}/>                      
        </Grid>
        <Grid item xs={3} md={3} lg={3}>
          <Card title="Repository" text={push.project}/>                      
        </Grid>          
        <Grid item xs={6} md={6} lg={6}>
          <Card title="Branch" text={push.branch.replace('refs/heads/', '')}/>
        </Grid>



        <Grid item xs={6} md={6} lg={6}>
          <Card title="From" text={push.commitTo.substring(8)}/>
        </Grid>

        <Grid item xs={6} md={6} lg={6}>
          <Card title="To" text={push.commitFrom.substring(8)}/>
        </Grid>           */}
            
        
        
        <Grid item xs={12} md={12} lg={12}>
          <Diff diff={push.diff.content}/>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}

