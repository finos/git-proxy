import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import styles from '../../assets/jss/material-dashboard-react/components/footerStyle';

const useStyles = makeStyles(styles);

export default function Footer(props) {
  const classes = useStyles();
  return (
    <footer className={classes.footer}>
      <div className={classes.container}>
        <div className={classes.left}>
          <List className={classes.list}>
            <ListItem className={classes.inlineBlock}>
              <a
                href='https://github.com/pGrovesy/git-proxy'
                className={classes.block}
                target='_blank'
                rel='noopener noreferrer'
              >
                Github
              </a>
            </ListItem>
          </List>
        </div>
        <p className={classes.right}>
          <span>&copy; {1900 + new Date().getYear()} Git Proxy</span>
        </p>
      </div>
    </footer>
  );
}
