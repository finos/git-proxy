import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// Import styles
import 'chartist/dist/chartist.min.css';
import 'font-awesome/css/font-awesome.min.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-design-icons/iconfont/material-icons.css';
import 'diff2html/bundles/css/diff2html.min.css';
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
