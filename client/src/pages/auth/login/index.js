import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSite } from '../../../context/sitecontext';
import * as userService from './../../../services/user';

const Login = ({ dispatch, user }) => {
  const { login, isLoggedIn, setIsLoading, refreshCartItems } = useSite();
  //const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({
    customer_username: "",
    password: "",
    remeberMe: "",
  });

  const [loginError, setLoginError] = useState({
    customer_username:{dirty:false,error:false,message:""},
    password: {dirty:false,error:false,message:""}
  });

  const onUpdateField = e => {
    const field = e.target.name;
    const nextFormState = {
      ...loginForm,
      [field]: e.target.value,
    };
    setLoginForm(nextFormState);

    if (loginError[field] && loginError[field].dirty){
      validateForm({
        form: nextFormState,
        errors : loginError,
        field,
      });
    }
  };

  const onBlurField = e => {
    const field = e.target.name;
    const fieldError = loginError[field];
    if (fieldError.dirty) return;
  
    const updatedErrors = {
      ...loginError,
      [field]: {
        ...loginError[field],
        dirty: true,
      },
    };
  
    validateForm({ form:loginForm, field, errors: updatedErrors });
  };

  const touchErrors = errors => {
    return Object.entries(errors).reduce((acc, [field, fieldError]) => {
      acc[field] = {
        ...fieldError,
        dirty: true,
      };
      return acc;
    }, {});
  };

  const userNameValidator = name => {
    if (!name) {
      return "Please enter username";
    }
    return "";
  };

  const passwordValidator = password => {
    if (!password) {
      return "Please enter password";
    } else if (password.length < 8) {
      return "Password must have a minimum 8 characters";
    }
    return "";
  };
  
  const validateForm = ({ form, field, errors, forceTouchErrors = false }) => {
    let isValid = true;
    
    // Create a deep copy of the errors
    let nextErrors = JSON.parse(JSON.stringify(errors))
  
    // Force validate all the fields
    if (forceTouchErrors) {
      nextErrors = touchErrors(errors);
    }
  
    const { customer_username, password } = form;
    if (nextErrors.customer_username.dirty && (field ? field === "customer_username" : true)) {
      const nameMessage = userNameValidator(customer_username);
      nextErrors.customer_username.error = !!nameMessage;
      nextErrors.customer_username.message = nameMessage;
      if (!!nameMessage) isValid = false;
    }
  
    if (nextErrors.password.dirty && (field ? field === "password" : true)) {
      const passwordMessage = passwordValidator(password);
      nextErrors.password.error = !!passwordMessage;
      nextErrors.password.message = passwordMessage;
      if (!!passwordMessage) isValid = false;
    }
  
    setLoginError(nextErrors);
  
    return {
      isValid,
      errors: nextErrors,
    };
  };

  const handleLogin = async(event)=>{
    event.preventDefault();
    const { isValid } = validateForm({ form : loginForm, errors : loginError, forceTouchErrors: true });
    if(isValid){
      setIsLoading(true);
      const response = await userService.login(loginForm.customer_username,loginForm.password);
      if(response){
        login({"id":response.id,
          "name":response.name, 
          "email": response.email, 
          "refreshToken":'',
          "authToken": response.token,
          "expiresAt": response.expires
        },true);
        refreshCartItems();
      }
      setIsLoading(false);
    }
  }
 
  return (
    <>
      <div className="container-fluid">
        {isLoggedIn === true && <Navigate to={'/'} />}
        <div className="mainBgColor pb-0 row">
            <div className="d-none d-md-block col-md-6 login-Image">
            </div>
            <div className="col-md-6 col-xs-12 text-center">
                <div className="loginbox">
                    <div className="footer_logo text-center">
                        <div className="footer-cicle">
                            <img src="/images/logo.png" alt="" style={{height:"60px",marginTop:"10px"}} />
                        </div>
                        <div className="footer-cicle position-relative" style={{left:"-12px"}}>
                            <img src="/images/cafe-logo.png?v=2" alt="" style={{height:"60px",marginTop:"10px"}} />
                        </div>
                    </div>

                    <div className="loginText">Welcome Back</div>
                    <div className="loginlabel">Please enter your credentials</div>

                    <form onSubmit={handleLogin}>
                      <div className="mt-4">
                          <div className="text-start">
                              <div className="loginlabel">Email ID/Username*</div>
                              <input type="text" name="customer_username" className="input-control w-100"  placeholder="Enter your username" 
                                value={loginForm.customer_username} onChange={onUpdateField} onBlur={onBlurField} />
                              {loginError.customer_username.dirty && loginError.customer_username.error ? (
                                <div className="position-relative mb-3">
                                  <div className="text-danger position-absolute top-5">{loginError.customer_username.message}</div>
                                </div>
                              ) : null}
                          </div>
                          <div className="text-start mt-3">
                              <div className="loginlabel">Password*</div>
                              <input type="password" name="password" autoComplete="off" placeholder="Password" className="input-control w-100" 
                                    value={loginForm.password} onChange={onUpdateField} onBlur={onBlurField} 
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleLogin(e)
                                      }
                                    }}  />
                              {loginError.password.dirty && loginError.password.error ? (
                                <div className="position-relative mb-3">
                                  <div className="text-danger  position-absolute top-5">{loginError.password.message}</div>
                                </div>
                              ) : null}
                          </div>
                          <div className="text-start mt-3 d-none">
                              <label className="loginlabel"><input type="checkbox" className="" placeholder="" value="" /> Remember me</label>
                          </div>

                          <div className="mt-3 mb-2 text-center" >
                              <button className="btn btn-primary-cofee w-100" type="button" onClick={handleLogin}>Login</button>
                          </div>
                      </div>
                    </form>
                </div>
            </div>
        </div>
      </div>
    </>
  )
}

export default Login
