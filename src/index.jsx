import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserHistory } from 'history';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// core components
import Admin from './ui/layouts/Admin';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';

const hist = createBrowserHistory();

const container = document.getElementById('root');
const root = createRoot(container);
const theme = createTheme();

root.render(
  <ThemeProvider theme={theme}>
    <Router history={hist}>
      <Routes>
        <Route exact path='/admin/*' element={<Admin />} />
        <Route exact path='/login' element={<Login />} />
        <Route exact path='/' element={<Navigate from='/' to='/admin/repo' />} />
      </Routes>
    </Router>
  </ThemeProvider>,
);
