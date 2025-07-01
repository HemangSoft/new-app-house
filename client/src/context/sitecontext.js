// File: ./src/context/userContext.js
import React, { useState, useEffect, createContext, useContext,useCallback } from 'react';
import store from 'store';

const loginUserKeyForStorage = 'user';
export const defaultAuthData = {
  id: '0',
  name: '',
  email: '',
  authToken: '',
  expiresAt: 0,
  refreshToken:''
}
export const SiteContext = createContext();

export default function SiteContextWrapper({ children }) {
  const {storedValue, setValue } = userLocalStorage(loginUserKeyForStorage,defaultAuthData);
  const [loginUser, setLoginUser] = useState(defaultAuthData);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isLoading, changeIsLoading] = useState(false);// Helpful, to update the UI accordingly.
  
  const fillDefaultValue = () =>{
    try{
        let userData = storedValue();
        let setupLoginToken = false;
        if(userData && userData.id && userData.id !== '0'){
          if(userData.expiresAt){
            let checkExpired = userData.expiresAt - new Date().getTime();
            if(checkExpired > 0){
              setupLoginToken = true;
            }
          }
        }
        
        if(setupLoginToken){
          setLoginUser(userData);
          setIsLoggedIn(true);
          store.set('accessToken', userData.authToken);
        }
        else{
          store.remove('accessToken');
        }
    }
    catch(e){
        console.log(e)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onLoadFillData = useCallback(fillDefaultValue, []);
  useEffect(() => {
    //console.log("load event from Store");
    onLoadFillData();
    return () => {
      //console.log("unload event from Store");
    };
  }, [onLoadFillData]);

  const login = (user,refreshLocalStorage) => {
    setLoginUser(user);
    if(refreshLocalStorage){
      setValue(user);
      setIsLoggedIn(true);
    }
    store.set('accessToken', user.authToken)
  };

  const logout = () => {
    setIsLoggedIn(false);
    setLoginUser(defaultAuthData);
    setValue(defaultAuthData);
    store.remove('accessToken');
  };

  const setIsLoading = (value)=>{
    changeIsLoading(value);
  }


  return (
    <SiteContext.Provider value={{ loginUser, isLoggedIn, isLoading, setIsLoading, login, logout}}>
      {children}
    </SiteContext.Provider>
  );
}

const userLocalStorage = (keyName:string, defaultValue:any) => {
  const storedValue = () => {
    try {
      const value = window.localStorage.getItem(keyName);
      if (value) {
        return JSON.parse(value);
      } else {
        window.localStorage.setItem(keyName, JSON.stringify(defaultValue));
        return defaultValue;
      }
    } catch (err) {
      return defaultValue;
    }
  };

  const setValue = (newValue:any) => {
    try {
      window.localStorage.setItem(keyName, JSON.stringify(newValue));
    } catch (err) {}
  };
  

  return {storedValue, setValue};
};

// Custom hook that shorhands the context!
export const useSite = () => useContext(SiteContext);