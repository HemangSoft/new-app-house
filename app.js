'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const compress = require('compression');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const cpuCount = require('os').cpus().length;
const http = require('http');
const https = require('https');
const config = require('./server/helpers/config');
const Errors = require('./server/helpers/errors');

const port = config.APP_PORT;
const sslPort = config.SSL_PORT||'';
global.appRoot = path.resolve(__dirname);
global.categoryProcess = {};
global.IRProcess = {};
global.POProcess = {};

const clientBuildPath = path.join(__dirname.replace("\server","") ,'build');

const app = express();
app.set('port', port);
app.use(compress());
app.use(bodyParser.json({limit: '25mb'})); //Added to avoid request entity too large error
app.use(bodyParser.urlencoded({limit: '25mb',extended: true})); //Added to avoid request entity too large error
app.use(bodyParser.urlencoded({extended: true})); // for parsing x-www-form-urlencoded

app.use(express.static(clientBuildPath, {maxAge: 31557600000}));
//app.use(express.static(path.join(__dirname, 'public'), {maxAge: 31557600000}));

/**
 * Log url
 */
app.all('/*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token');
    if (req.method == 'OPTIONS') {
        res.status(200).end();
    } else {
        next();
    }
});

// authorized /v1 route
app.all('/api/v1/*', [require('./server/middlewares/validate')]);
app.use('/api', require('./server/routes'));

app.get('*', (req, res) => {
    let url = req.url.toLowerCase();
    if(url.indexOf("/api") == 0){
        res.status(404).json({
            "status": 404,
            "message": "Invalid URL",
        });
        console.log(`\x1b[33mInvalid URL "${(req.originalUrl?req.originalUrl:'')}" Time : ${new Date()} \x1b[0m`);
    }
    else{
        res.sendFile(clientBuildPath + '/index.html');
    }
});

async function shutdown(){
    process.exit();
}

process.once('SIGTERM', () => {
    console.log('Received SIGTERM');
    shutdown();
});
  
process.once('SIGINT', () => {
    console.log('Received SIGINT = STOP SERVER EVENT');
    shutdown();
});

process.once('uncaughtException', err => {
    console.log('Uncaught exception');
    console.error(err.stack);
    shutdown(err);
});

async function initApplication(){
    //Attach varaible to each request
    app.errors = Errors;
    
    app.listen(port, function () {
      console.log('App running Port: %d', port);
    });
}
initApplication();

module.exports = app;
