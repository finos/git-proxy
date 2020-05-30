import React from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import LayersIcon from '@material-ui/icons/Layers';

export const mainListItems = (
  <div>
    <a href="/">
      <ListItem button>
        <ListItemIcon>
          <LayersIcon />
        </ListItemIcon>
        <ListItemText primary="Open Pushes" />
      </ListItem> 
    </a>   
  </div>
);

export const secondaryListItems = (
  <div>

  </div>
);
