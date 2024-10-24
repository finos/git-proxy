import React from 'react';
import makeStyles from '@mui/styles/makeStyles';
import ListItem from '@mui/material/ListItem';
import List from '@mui/material/List';
import styles from '../../assets/jss/material-dashboard-react/components/footerStyle';
import { MarkGithubIcon } from '@primer/octicons-react';

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
                href='https://github.com/finos/git-proxy'
                className={classes.block}
                target='_blank'
                rel='noopener noreferrer'
              >
                <MarkGithubIcon />
              </a>
            </ListItem>
          </List>
        </div>
        <p className={classes.right}>
          <span>&copy; {1900 + new Date().getYear()} GitProxy</span>
        </p>
      </div>
    </footer>
  );
}
