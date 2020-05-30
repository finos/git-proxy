import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';
import { useParams } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import Title from './Title';
import Card from './Card';
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
        console.log(res)
        setPush(res)
      })
      .catch(err => setErrors(err));
  }
  
  useEffect(() => {
    fetchData();
  }, []);

  if (push.length === 0) {
    return <div><h3>Loading</h3></div>
  } else {
    
    return (

      <React.Fragment>
        <Title>Push Details {id}</Title>
        <Divider />
        <br/>
        <Grid container spacing={1}>
          <Grid item xs={2} md={2} lg={2}>
            <Card title="Repository" text={push.repoName}/>                      
          </Grid>
          <Grid item xs={2} md={2} lg={2}>
            <Card title="Branch" text={push.branch.replace('refs/heads/', '')}/>
          </Grid>
          <Grid item xs={4} md={4} lg={4}>
            <Card title="From" text={push.commit.substring(8)}/>
          </Grid>

          <Grid item xs={4} md={4} lg={4}>
            <Card title="To" text={push.commit2.substring(8)}/>
          </Grid>          
              
        
          <Grid item xs={12} md={12} lg={12}>
            <Diff diff={push.actionLog[3].logs}/>
          </Grid>
        </Grid>
      </React.Fragment>
    );
  }
}
