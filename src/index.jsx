import React from 'react';
import ReactDOM from 'react-dom';
import { createBrowserHistory } from 'history';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// core components
import Admin from './ui/layouts/Admin';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';

const hist = createBrowserHistory();

ReactDOM.render(
  <Router history={hist}>
    <Routes>
      <Route exact path='/admin/*' element={<Admin />} />
      <Route exact path='/login' element={<Login />} />
      <Route exact path='/' element={<Navigate from='/' to='/login' />} />
    </Routes>
  </Router>,
  document.getElementById('root'),
);
