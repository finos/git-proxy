import React, { useState, useEffect } from 'react';
import { Redirect } from "react-router-dom";
import moment from "moment";
import { useHistory } from "react-router-dom";
import Icon from "@material-ui/core/Icon";
import GridItem from "ui/components/Grid/GridItem.js";
import GridContainer from "ui/components/Grid/GridContainer.js";
import Card from "ui/components/Card/Card.js";
import CardIcon from "ui/components/Card/CardIcon.js";
import CardBody from "ui/components/Card/CardBody.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardFooter from "ui/components/Card/CardFooter.js";
import Button from "ui/components/CustomButtons/Button.js";
import Diff from "./components/Diff";
import { getPush, authorisePush, rejectPush, cancelPush } from "../../services/git-push.js";

export default function Dashboard(props) {  
  const id = props.match.params.id;  
  const [data, setData] = useState([]);  
  const [auth, setAuth] = useState(true);  
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const history = useHistory();

  useEffect(() => {
    getPush(id, setIsLoading, setData, setAuth, setIsError);
  }, [id]);

  const authorise = async () => {
    await authorisePush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  }

  const reject = async () => {
    await rejectPush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  }
 
  const cancel = async () => {
    await cancelPush(id, setAuth, setIsError);
    history.push(`/admin/push/`);
  }

  if (isLoading) return(<div>Loading ...</div>);
  if (isError) return(<div>Something went wrong ...</div>);
  if (!auth) return(<Redirect to={{pathname: '/login'}} />);

  return (    
    <GridContainer>        
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color="success" stats icon>
            <CardIcon color="success">
              <Icon>content_copy</Icon>
            </CardIcon>          
          </CardHeader>
          <CardBody>
            <GridContainer>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Commit</h3>            
                <p>{moment(data.timestamp).toString()}</p>
              </GridItem>              
              <GridItem xs={3} sm={3} md={3}>
                <h3>Commit From</h3>            
                <p>{data.commitFrom}</p>
              </GridItem>
              <GridItem xs={3} sm={3} md={3}>
                <h3>Commit From</h3>            
                <p>{data.commitTo}</p>
              </GridItem>              
              <GridItem xs={2} sm={2} md={2}>
                <h3>Repo</h3>            
                <p>{data.repo}</p>
              </GridItem>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Branch</h3>            
                <p>{data.branch.replace('refs/heads/', '')}</p>
              </GridItem>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Author</h3>            
                <p>{data.author} pGrovesy</p>
              </GridItem>
              <GridItem xs={10} sm={10} md={10}>
                <h3>Message</h3>
                <p>{data.commitMessage} Temporary placeholder message</p>
              </GridItem>              
            </GridContainer>        
          </CardBody>
        </Card>
      </GridItem>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader></CardHeader>
          <CardBody>
            <Diff diff={data.diff.content}/>
          </CardBody>
          <CardFooter>
            <Button onClick={ async () => { await cancel() } }>Cancel</Button>
            <Button onClick={ async () => { await reject() } }>Rject</Button>
            <Button onClick={ async () => { await authorise() }}>Approve</Button>
          </CardFooter>
        </Card>
      </GridItem>                
    </GridContainer>    
  );
}
