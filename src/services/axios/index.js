import axios from 'axios';
import store from 'store';
import { toast } from 'react-toastify';

const apiClient = axios.create({
  baseURL: '/api',
  // timeout: 1000,
  // headers: { 'X-Custom-Header': 'foobar' }
})

apiClient.interceptors.request.use(request => {
  const accessToken = store.get('accessToken');
  if (accessToken) {
    request.headers.Authorization = `Bearer ${accessToken}`
    request.headers.access_token = accessToken
  }
  return request
})

apiClient.interceptors.response.use(undefined, error => {
  // Errors handling
  const { response } = error
  const { data, config } = response;
  if (data && data.message) {
    let validateTokenURL = false;
    if(config && config.url && config.url.toLowerCase() === "/v1/loginuser"){
      validateTokenURL = true;
    }
    if(!validateTokenURL)
    {
      if(data.message && data.message === 'Session Expired, Please login again'){
        store.remove('accessToken');
        store.remove('user');
        window.location.href= "/login";
      }
      else{
        toast.error(data.message, {position: "top-right"});
      }
    }
  }
})

export default apiClient
