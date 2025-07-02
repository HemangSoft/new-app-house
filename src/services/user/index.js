import apiClient from '../axios'
import store from 'store'

export async function login(userName, password) {
  return apiClient
    .post('/login', {
      userName,
      password,
    })
    .then(response => {
        if (response) {
            const { token } = response.data
            if (token) {
            store.set('accessToken', token)
            }
            return response.data
        }
        return false
    })
    .catch(err => console.log(err))
}

export async function currentAccount() {
  return apiClient
    .get('/v1/loginuser')
    .then(response => {
      if (response) {
        const { accessToken } = response.data
        if (accessToken) {
          store.set('accessToken', accessToken)
        }
        return response.data
      }
      return false
    })
    .catch(err => console.log(err))
}

export async function logout() {
  return apiClient
    .get('/logout')
    .then(() => {
      store.remove('accessToken');
      return true
    })
    .catch(err => console.log(err))
}
