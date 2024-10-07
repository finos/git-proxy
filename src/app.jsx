import React from 'react';
import { createBrowserHistory } from 'history';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// core components
import Admin from './ui/layouts/Admin';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';

const hist = createBrowserHistory();
const theme = createTheme();

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <AppRoutes />
    </ThemeProvider>
  );
}

function AppRoutes() {
  return (
    <Router history={hist}>
      <Routes>
        <Route exact path='/admin/*' element={<Admin />} />
        <Route exact path='/login' element={<Login />} />
        <Route exact path='/' element={<Navigate from='/' to='/admin/repo' />} />
      </Routes>
    </Router>
  );
}
