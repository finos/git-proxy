import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './ui/auth/AuthProvider';

// core components
import Dashboard from './ui/layouts/Dashboard';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';
import NotAuthorized from './ui/views/Extras/NotAuthorized';
import NotFound from './ui/views/Extras/NotFound';

ReactDOM.render(
  <AuthProvider>
    <Router>
      <Routes>
        <Route path='/dashboard/*' element={<Dashboard />} />
        <Route path='/login' element={<Login />} />
        <Route path='/not-authorized' element={<NotAuthorized />} />
        <Route path='/' element={<Navigate to='/dashboard/repo' />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </Router>
  </AuthProvider>,
  document.getElementById('root'),
);
