'use strict';
require('dotenv').config({silent: true});

module.exports = {
    DEVELOPMENT: process.env.DEVELOPMENT,
    APP_PORT: process.env.APP_PORT,
    SSL_PORT: process.env.SSL_PORT,
    SITE_URL:process.env.SITE_URL,
    ERMS_WEBURL: process.env.ERMS_WEBURL,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_SETTING: process.env.SMTP_SETTING,
    OPENAI_KEY: process.env.OPENAI_KEY,

    ERMS_USERNAME: process.env.ERMS_USERNAME,
    ERMS_PASSWORD: process.env.ERMS_PASSWORD,
    ERMS_IMPORT_SKIP_ITEMS:process.env.ERMS_IMPORT_SKIP_ITEMS,
    ERMS_IMPORT_UNIONMT_CA_EA:process.env.ERMS_IMPORT_UNIONMT_CA_EA,

    SUPABASE_INV_URL: process.env.SUPABASE_INV_URL,
    SUPABASE_INV_PASS: process.env.SUPABASE_INV_PASS,

    NETSUITE_DEFAULT_SERVER: process.env.NETSUITE_DEFAULT_SERVER,
    //SB1 Server Setup
    base_url_rest_sb1:process.env.SB1_BASE_URL_REST,
    base_url_sql_sb1:process.env.SB1_BASE_URL_SQL,
    realm_sb1:process.env.SB1_REALM,
    netSuiteToken_sb1: {
        key: process.env.SB1_TOKEN_KEY,
        secret: process.env.SB1_TOKEN_SECRET
    },
    netSuiteConsumerToken_sb1: {
        key: process.env.SB1_CONSUMER_KEY,
        secret: process.env.SB1_CONSUMER_SECRET
    },

    //SB2 Server Setup
    base_url_rest_sb2:process.env.SB2_BASE_URL_REST,
    base_url_sql_sb2:process.env.SB2_BASE_URL_SQL,
    realm_sb2:process.env.SB2_REALM,
    netSuiteToken_sb2: {
        key: process.env.SB2_TOKEN_KEY,
        secret: process.env.SB2_TOKEN_SECRET
    },
    netSuiteConsumerToken_sb2: {
        key: process.env.SB2_CONSUMER_KEY,
        secret: process.env.SB2_CONSUMER_SECRET
    },

    //Production Server Setup
    base_url_rest_prod:process.env.PROD_BASE_URL_REST,
    base_url_sql_prod:process.env.PROD_BASE_URL_SQL,
    realm_prod:process.env.PROD_REALM,
    netSuiteToken_prod: {
        key: process.env.PROD_TOKEN_KEY,
        secret: process.env.PROD_TOKEN_SECRET
    },
    netSuiteConsumerToken_prod: {
        key: process.env.PROD_CONSUMER_KEY,
        secret: process.env.PROD_CONSUMER_SECRET
    },
};
