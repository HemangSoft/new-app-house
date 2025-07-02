import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import Layout from './layouts'
import Home from './pages/home/index.js';

import Login from './pages/auth/login';
import System404 from './pages/auth/notfound';
import System500 from './pages/auth/servererr';

//This is process shown to client when using lazy loading for large web app
//const LoadingMsg = () => {return <p>Loading ...</p>};  fallback={<LoadingMsg />}
const Router = () => {
  return (
    <Layout>
            <React.Suspense />    
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/home' element={<Home />} />
                
                <Route path='/login' element={<Login />} />
                <Route path='/auth/404' element={<System404 />} />
                <Route path='/auth/500' element={<System500 />} />

                {/*  Default route and replace is to avoid back key after display */}
                <Route  path="*"  element={<Navigate to="/" replace={true} />} />
            </Routes>
      </Layout>
  )
}

export default Router