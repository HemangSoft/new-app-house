/* eslint-disable jsx-a11y/anchor-is-valid */
import React from 'react';//  {  useEffect,useCallback }

const MainLayout = ({ children, ...props }) => {
    return (
        <div className="mainBgColor">
            <div className="container-fluid p-3 pb-0 pt-2">
                {children}
             </div>
        </div>
  )
}

export default MainLayout