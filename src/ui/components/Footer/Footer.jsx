import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import styles from '../../assets/jss/material-dashboard-react/components/footerStyle';
import { MarkGithubIcon } from '@primer/octicons-react';

const useStyles = makeStyles(styles);

export default function Footer() {
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
      <img referrerPolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=afd0e5de-d4dc-42e3-bb72-6fc64323c5d0" />
    </footer>
  );
}
