import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// core components
import Admin from './ui/layouts/Admin';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';

ReactDOM.render(
  <Router>
    <Routes>
      <Route path='/admin/*' element={<Admin />} />
      <Route path='/login' element={<Login />} />
      <Route path='/' element={<Navigate to='/admin/repo' />} />
    </Routes>
  </Router>,
  document.getElementById('root'),
);
