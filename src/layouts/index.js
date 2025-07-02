import React, { Fragment } from 'react'; //useState, useEffect, useCallback, 
import { useLocation, Link } from 'react-router-dom';

import PublicLayout from './Public'
import AuthLayout from './Auth'
import MainLayout from './Main'
import { useSite } from '../context/sitecontext';

const Layouts = {
  public: PublicLayout,
  auth: AuthLayout,
  main: MainLayout,
}

let previousPath = ''
const Layout = ({ children, ...props }) => {
    const { isLoading} = useSite();
    const location = useLocation();
    const pathname = location.pathname.toLowerCase();

    const currentPath = pathname;
    //const isLoginPage = (currentPath.indexOf("/login") === 0)
    //console.log(currentPath , " ", previousPath)
    if (currentPath !== previousPath) {
        window.scrollTo(0, 0)
       // NProgress.start()
    }
    setTimeout(() => {
        //NProgress.done()
        previousPath = currentPath;
    }, 1000)

    // Layout Rendering
    const getLayout = () => {
        // if (pathname === '/') {
        //   return 'public'
        // }
        if (/^\/login(?=\/|$)/i.test(pathname)) {
        return 'main';// 'auth'
        }
        return 'main'
    }

    const Container = Layouts[getLayout()]
    //const isUserAuthorized = isLoggedIn;
    const isUserLoading = isLoading;
    //const isAuthLayout = getLayout() === 'auth'

    const BootstrappedLayout = () => {
        // in other case render previously set layout
        return <Container>{children}</Container>
    }

    return (
    <Fragment>
        <header className="header1 border-bottom container-fluid pt-2 pb-2 position-relative">
            <div className="row align-items-center">
                <div className="col-12">
                    <div className="header_logo_area">
                        <Link to={"/"} className="header_logo">
                            <div className="footer_logo text-center">
                                <div className="logo-cicle">
                                    <img src="/images/logo.png" alt="" />
                                </div>
                                <span>Dora's Naturals</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    
        <div id="mainBody">
            {BootstrappedLayout()}
        </div>
        
        {isUserLoading && <div id="spProcess">
          <i className="fa fa-spin fa-spinner  fa-4x" />
        </div>}
        
    </Fragment>
  )
}

export default Layout
