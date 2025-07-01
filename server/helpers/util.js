'use strict';
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const config = require('.//config.js');

class Util {
    constructor() { 
      this.smtpSetting = config.SMTP_SETTING
    }
    
    STMPSetting(){
        return this.smtpSetting;
    }


    isValidInput(value){
      return value !== undefined && value !== null && value !== "";
    }

    isNonEmptyArray(value) {
      return Array.isArray(value) && value.length > 0;
    }

    async customDelay(ms){
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    getDefaultAPIServer() {
      return config.NETSUITE_DEFAULT_SERVER;
    }

    getBaseRestURL(apiServer='PROD') {
      let baseURL = config.base_url_rest_prod;
      if(apiServer == 'SB1'){
        baseURL =  config.base_url_rest_sb1;
      }
      else if(apiServer == 'SB2'){
        baseURL =  config.base_url_rest_sb2;
      }
      return baseURL;
    }

    getBaseSuiteQLURL(apiServer='PROD') {
      let baseURL = config.base_url_sql_prod;
      if(apiServer == 'SB1'){
        baseURL =  config.base_url_sql_sb1;
      }
      else if(apiServer == 'SB2'){
        baseURL =  config.base_url_sql_sb2;
      }
      return baseURL;
    }

    createOAuthHeader(requestURL,methodType,apiServer='PROD') {
      let netSuiteConsumerToken = config.netSuiteConsumerToken_prod;
      let netSuiteTokenKeySecret = config.netSuiteToken_prod;
      let netSuiteRelam = config.realm_prod;
      if(apiServer == 'SB1'){
        netSuiteConsumerToken = config.netSuiteConsumerToken_sb1;
        netSuiteTokenKeySecret = config.netSuiteToken_sb1;
        netSuiteRelam = config.realm_sb1;
      }
      else if(apiServer == 'SB2'){
        netSuiteConsumerToken = config.netSuiteConsumerToken_sb2;
        netSuiteTokenKeySecret = config.netSuiteToken_sb2;
        netSuiteRelam = config.realm_sb2;
      }

      const request_data = {
          url: requestURL,
          method: methodType,
          headers: {
              'Content-Type': 'application/json',
              'Prefer': 'transient'
          }
      };
      
      const oauth = OAuth({
          consumer: netSuiteConsumerToken,
          signature_method: 'HMAC-SHA256',
          nonce_length:11,
          hash_function(base_string, key) {
              return crypto
                  .createHmac('sha256', key)
                  .update(base_string)
                  .digest('base64');
          }
      });
  
      const buildAuthorizationHeader = (authData) => {
          const headerParts = [];
          for (const [key, value] of Object.entries(authData)) {
              const encodedValue = encodeURIComponent(value);
              headerParts.push(`${key}="${encodedValue}"`);
          }
          return `OAuth ${headerParts.join(', ')}`;
      };
  
      const authorizationData = oauth.authorize(request_data,netSuiteTokenKeySecret);

      //Below code check for allowed Valid keys and remove extra keys added to authorization header
      const validKeys = ['oauth_consumer_key','oauth_nonce','oauth_signature_method','oauth_timestamp','oauth_version','oauth_token','oauth_signature'];
      const authDataAllKeys = Object.keys(authorizationData);
      authDataAllKeys.forEach(function(d){
          if(validKeys.indexOf(d) == -1){
              delete authorizationData[d];
          }
      });
      
      const authHeader = buildAuthorizationHeader({
          realm: netSuiteRelam,
          ...authorizationData
      });
  
      const headers = {
          ...request_data.headers,
          'Authorization': authHeader,
          'user-agent': "Dora's NetSuite ETL"
      };

      return headers;
    }

    generateUniqueId(length = 12) {
      return crypto.randomBytes(length).toString('hex').slice(0, length);
    }
}

module.exports = new Util();