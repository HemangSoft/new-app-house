/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect,useCallback } from 'react';// useState, 

const AuthLayout = ({ children, ...props }) => {
  //const { productLines, setProductlines } = useSite();

  const fillData = async()=>{
    // if(productLines.length === 0){
    //     fillProductLines();
    // }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onLoadFillData = useCallback(fillData, []);
  useEffect(() => {
      //console.log("component mount event");
      onLoadFillData();
      return () => {
          //console.log("component unmount event");
      };
  }, [onLoadFillData]);


  return (
    <>
     {children}
    </>
  )
}

export default AuthLayout
