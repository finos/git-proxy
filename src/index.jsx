import React from 'react';
import ReactDOM from 'react-dom';
import { createBrowserHistory } from 'history';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './ui/auth/AuthProvider';

// core components
import Admin from './ui/layouts/Admin';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';
import NotAuthorized from './ui/views/Extras/NotAuthorized';
import NotFound from './ui/views/Extras/NotFound';

const hist = createBrowserHistory();

ReactDOM.render(
  <AuthProvider>
    <Router history={hist}>
      <Routes>
        <Route exact path='/admin/*' element={<Admin />} />
        <Route exact path='/login' element={<Login />} />
        <Route exact path='/not-authorized' element={<NotAuthorized />} />
        <Route exact path='/' element={<Navigate from='/' to='/admin/repo' />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </Router>
  </AuthProvider>,
  document.getElementById('root'),
);
