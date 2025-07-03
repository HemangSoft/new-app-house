'use strict'
const axios= require('axios');
const dayjs = require('dayjs');
const https = require('https');
const advancedFormat = require("dayjs/plugin/advancedFormat");
const fs = require('fs');
const config = require('..//..//helpers//config.js');
const Util = require('..//..//helpers//util.js');
const DBSuperBase = require('..//..//helpers/db-supabase.js');
const commonMaster = require('./commonmaster.js');
const DEFAULT_API_SERVER = Util.getDefaultAPIServer();
dayjs.extend(advancedFormat);

function inventoryAdjustmentPayload(){
    let payloadStructure = { 
        "account": { //<==Fixed
            "id": "558",
            "refName": "510200 COST OF GOODS SOLD : DISTRIBUTION - COGS QUANTITY VARIANCE"
        },
        "tranDate":"",
        "inventory": {
            "items": [
                /*{
                    "adjustQtyBy": -8.0,
                    "inventoryDetail": {
                        "inventoryAssignment": {
                            "items": [
                                {
                                    "issueInventoryNumber": {
                                        "id": "31"
                                    },
                                    "quantity": -8.0
                                }
                            ]
                        },
                        "item": {
                            "id": "11980"
                        },
                        "location": {
                            "id": "30"
                        },
                        "quantity": -8.0
                    },
                    "item": {
                        "id": "11980"
                    },
                    "line": 1,
                    "location": {
                        "id": "30"
                    }
                }*/
            ]
        },
        "memo": "",
        "postingPeriod": {
            "id": "0",
            "refName": "" //Jun 2025
        },
        "subsidiary": {  //<==Fixed
            "id": "18",
            "refName": "DORA'S NATURALS, INC."
        }
    }
    return payloadStructure;
}

exports.inventoryAdjustment = async (req, res) => {
    let apiServer = DEFAULT_API_SERVER;
    let inventorydate = (req.body.inventorydate||'').replace(/-/g,'');
    let category = req.body.category||'';
    let categoryList = req.body.categoryList||[];
    let sendAJAXUpdate = req.body.ajaxupdate||0;
    let finalCategoryList = [];
    if(category != ""){
        finalCategoryList.push(category);
    }
    else if(Util.isNonEmptyArray(categoryList)){
        finalCategoryList = categoryList;
    }
    
    let inventorydateDayjs;
    if(inventorydate == ''){
        return res.status(400).json({
            "status": 400,
            "message": "Please provide inventory date parameter"
        });
    }
    else{
        inventorydateDayjs = dayjs(inventorydate,'YYYYMMDD');
        if(inventorydateDayjs.format('YYYYMMDD') != inventorydate){
            return res.status(400).json({
                "status": 400,
                "message": "Please provide valid load date parameter"
            });
        }
    }

    if(finalCategoryList.length == 0){
        return res.status(400).json({
                "status": 400,
                "message": "Please provide category or categoryList parameter"
        });
    }


    let finalResponse = [];
    let payload = inventoryAdjustmentPayload();
    payload.tranDate = inventorydateDayjs.format('YYYY-MM-DD') + "T0:00:00";
    
    //Step 1=> Fetch accounting period from supabase   => payload.postingPeriod = { "id": "63","refName": "Jun 2025"}; 
    console.log("fetching accounting period ", new Date());
    let { data : accPeriodData, error : supaErr1 } = await DBSuperBase.getAccountingPeriod(inventorydateDayjs.format('YYYY-MM-DD'));
    if(supaErr1){
        console.log(supaErr1);
        return res.status(400).send({"status":400,"error":"Error while fetching accounting period from supabase"});
    }
    else{
        if(accPeriodData.length > 0){
            payload.postingPeriod = { "id": accPeriodData[0].id,"refName": accPeriodData[0].periodname}; 
        }
        else{
            return res.status(400).send({"status":400,"error":"Error while fetching accounting period from supabase"});
        }
    }
    
    //Step 2 => fetch data from supabase
    console.log("fetching excel_validation data ", new Date());
    let { data : ermsInventoryData, error : supaErr2 } = await DBSuperBase.getExcelValidation(inventorydate,finalCategoryList);
    if(supaErr2){
        console.log(supaErr2);
        return res.status(400).send({"status":400,"error":"Error while fetching inventory data from supabase"});
    }
    let allCategory = [...new Set(ermsInventoryData.map((x)=>x.category))];
    
    //Step 3 => fetch items master with totalquantityonhand at Netsuite level
    console.log("fetching items master with totalquantityonhand at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr, allData : netSuiteItems} = await commonMaster.viewNetSuiteData('ITEM-STOCK',DEFAULT_API_SERVER);
    if(netSuiteErr){
        console.log(netSuiteErr);
        return res.status(400).send({"status":400,"error":"Error while fetching item data from netsuite", netSuiteErr});
    }

    //Step 4 => fetch inventoryNumber at Netsuite level
    console.log("fetching inventoryNumber at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr2, allData : netSuiteInventoryNumber} = await commonMaster.viewNetSuiteData('inventoryNumber',DEFAULT_API_SERVER);
    if(netSuiteErr2){
        console.log(netSuiteErr2);
        return res.status(400).send({"status":400,"error":"Error while fetching inventoryNumber data from netsuite", netSuiteErr2});
    }

    let global_variable ='';
    let totalCategory = allCategory.length;
    if(sendAJAXUpdate == 1){
        global_variable = Util.generateUniqueId(12);
        global.categoryProcess[global_variable] = {"total":totalCategory,"completed":0,"start":new Date().getTime()};
        res.status(200).send({"status":200,"total":totalCategory,"completed":0,"name":global_variable})
    }

    //Step 5 => setup log for each category
    //Step 5 => setup log for each category
    for(let categoryLoop=0;categoryLoop<totalCategory;categoryLoop++){
        let currentCategory = allCategory[categoryLoop];
        let itemData = ermsInventoryData.filter((x)=>x.category == currentCategory);
        console.log("setup payload for category "+  currentCategory + " ", new Date());

        let totalRecords = itemData.length;
        let itemErrors = [];
        let itemSuccess = [];
        let itemForAdjustment = [];
        for(let loop=0;loop<totalRecords;loop++){
            let itemInternalID = itemData[loop].netsuite_item_id;
            let itemId =  itemData[loop].item_id;
            let newQty = itemData[loop].physical_count;
            let itemName = itemData[loop].item_description;
            let casePackSize = parseInt(itemData[loop].case_pack);
            if(isNaN(casePackSize)) casePackSize= 1;
            
            let netSuiteItemInActive ='F';
            let netSuiteBalance = 0;
            let itemIndex = netSuiteItems.findIndex((x) => x.itemid == itemId);
            if(itemIndex > -1){
                let netSuiteQty = parseInt(netSuiteItems[itemIndex].totalquantityonhand||0);
                if(isNaN(netSuiteQty)) netSuiteQty= 0;
                if(netSuiteQty > 0){
                    let netSuiteCasePack = parseInt(netSuiteItems[itemIndex].custitemcase_pack);
                    if(isNaN(netSuiteCasePack)) netSuiteCasePack= casePackSize;
                    netSuiteBalance = netSuiteQty/ netSuiteCasePack;
                }

                netSuiteItemInActive = netSuiteItems[itemIndex].isinactive;
                itemInternalID = parseInt(netSuiteItems[itemIndex].id||0);
                if(isNaN(itemInternalID)) itemInternalID= 1;

               // console.log(" ",JSON.stringify(netSuiteItems[itemIndex]) ," \n netSuiteQty ", netSuiteQty , " netSuiteCasePack ", netSuiteCasePack , " NetsuiteBal ", netSuiteBalance , " newQty", newQty ,  " diff", newQty - netSuiteBalance);
            }
            
            //netsuite 2000 and supabase 1850 then adjustment = 1850 - 2000 = -150
            //netsuite 2000 and supabase 2020 then adjustment = 2020 - 2000 = 20
            let totalAdjQty = newQty - netSuiteBalance;
            let inventoryNumberIndex = -1;
            let inventoryNumberData = netSuiteInventoryNumber.filter((x) => x.item == itemInternalID);
            if(inventoryNumberData.length > 0){
                inventoryNumberIndex = 0;
                if(inventoryNumberData.length > 1){
                    let checkSameItemERMSIndex = inventoryNumberData.findIndex((x)=>x.inventorynumber == itemId +"-ERMS");
                    if(checkSameItemERMSIndex > -1){
                        inventoryNumberIndex = checkSameItemERMSIndex;
                    }
                }
            }

            if(itemInternalID == 0 || itemIndex == -1 || totalAdjQty == 0 || (totalAdjQty < 0 && inventoryNumberIndex == -1) || netSuiteItemInActive == 'T'){
                let itemError = 'Item# '+ itemId + ' '+ (itemInternalID ==0?" => missing item internal ID":"")  +
                            (itemIndex == -1?" => missing item at netsuite level":"") +
                            (totalAdjQty == 0?" => No adjustment required":"") +
                            (netSuiteItemInActive == 'T'?" => netsuite level Item is inactive":"") +
                            ((totalAdjQty < 0 && inventoryNumberIndex == -1)?" => Serial/Lot Number required for negative adjustment":"")
                //console.log(itemError);
                itemErrors.push({"inventory_date": inventorydate,"item_id":itemId,"quantity":newQty,"message":itemError});
                continue;
            }
            else{
                itemErrors.push({"inventory_date": inventorydate,"item_id":itemId,"quantity":newQty,"message":"success"});
            }
            
            let invAdjItem = {};
            if(inventoryNumberIndex > -1){
                invAdjItem = {"issueInventoryNumber": { "id": inventoryNumberData[inventoryNumberIndex].id}};
            }

            itemForAdjustment.push({
                    "adjustQtyBy": totalAdjQty,
                    "inventoryDetail": {
                        "inventoryAssignment": {
                            "items": [
                                {
                                    ...invAdjItem,
                                    "receiptInventoryNumber": itemId +"-ERMS",
                                    "quantity": totalAdjQty
                                }
                            ]
                        },
                        "item": {
                            "id": itemInternalID              
                        },
                        "location": {
                            "id": "30"
                        },
                        "quantity": totalAdjQty
                    },
                    "item": {
                        "id": itemInternalID
                    },
                    "line": (itemForAdjustment.length  + 1),
                    "location": {
                        "id": "30"
                    },
                    "memo": "CC-"+ itemId +"-"+  inventorydate
            })
        }
        
        let invAPISuccess = false; 
        if(itemForAdjustment.length > 0){
            payload.memo =  "CC-" + inventorydate + "-" + currentCategory;
            payload.inventory = {"items":itemForAdjustment};

            console.log("call inventory adjustment api for category "+  currentCategory + " ", new Date());
            try{
                const methodType = 'POST';
                const postURL = Util.getBaseRestURL(apiServer) + 'inventoryAdjustment';
                const headers = Util.createOAuthHeader(postURL, methodType, apiServer);

                const response = await axios.post(postURL, payload, {headers: headers});
                const dataJSON = await response;
                invAPISuccess = true; 
                finalResponse.push({"status":200,"category": currentCategory,"error":"","message":"Record generated successfully","issueItems": itemErrors});
            }
            catch(e){
                if (e.response) {
                    // console.error('NetSuite API Error Response:');
                    // console.error('Status:', e.response.status);
                    console.error('Data:', e.response.data);
                    const firstErrorDetail = e.response.data["o:errorDetails"][0];
                    finalResponse.push({"status":400,"category": currentCategory,"error":"Error while saving item adjustment -"+ firstErrorDetail?.detail,"message":"","issueItems": itemErrors,"payload":payload});
                }
                else {
                    // Error in setting up the request
                    console.error('Error creating NetSuite API request ',e?.message);
                    finalResponse.push({"status":400,"category": currentCategory,"error":"Error while saving item adjustment -"+ e?.message,"message":"","issueItems": itemErrors,"payload":payload});
                }
            }
            await Util.customDelay(1000);
        }
        else{
            finalResponse.push({"status":200,"category": currentCategory,"error":"","message":"No adjustment for category","issueItems": itemErrors});
        }

        if(invAPISuccess == false){
            // itemErrors.forEach((d) => {
            //     if(d.message == 'success'){
            //         d.message = 'Netsuite API Request failed'
            //     }
            // });
            if(itemForAdjustment.length > 0){
                itemErrors = [{"inventory_date": inventorydate,"item_id":'0',"quantity":'0',"message":"CC - Netsuite API Request failed for Category "+ currentCategory}];
            }
        }

        //Save each item log for request
        console.log("save inventory adjustment each item log for category "+  currentCategory + " ", new Date());
        let { data : apiLogData, error : errLog } = await DBSuperBase.saveInventoryAdjustmentAPILog(itemErrors);
        if(errLog){
            console.log(errLog);
        }
        global.categoryProcess[global_variable].completed = (categoryLoop + 1);
        //console.log(" global_variable ", global_variable , " ", global.categoryProcess[global_variable])
    }
    if(sendAJAXUpdate != 1){
        return res.status(200).send({"message":"OK","category_response":finalResponse});
    }
}

exports.inventoryAdjustmentProgress = async(req,res)=>{
    let name = (req.body.name||'');
    if(global.categoryProcess[name]){
        return res.status(200).send({"status":200,"data":global.categoryProcess[name]});
    }
    else{
        return res.status(400).send({"status":400,"message":"Import progress data missing"});
    }
}

exports.inventoryRelief = async(req,res)=>{
    let apiServer = DEFAULT_API_SERVER;
    let inputData = req.body.items||[];

    let IRProcessName = global.IRProcess && global.IRProcess.name||'';
    if(!Util.isNonEmptyArray(inputData)){
        return res.status(400).send({"status":400,"error":"No items data for process"});
    }
    
    let finalResponse = [];
    
    //Step 1 => fetch items master with totalquantityonhand at Netsuite level
    console.log("fetching items master with totalquantityonhand at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr, allData : netSuiteItems} = await commonMaster.viewNetSuiteData('ITEM-STOCK',DEFAULT_API_SERVER);
    if(netSuiteErr){
        console.log(netSuiteErr);
        return res.status(400).send({"status":400,"error":"Error while fetching item data from netsuite", netSuiteErr});
    }

    //Step 2 => fetch inventoryNumber at Netsuite level
    console.log("fetching inventoryNumber at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr2, allData : netSuiteInventoryNumber} = await commonMaster.viewNetSuiteData('inventoryNumber',DEFAULT_API_SERVER);
    if(netSuiteErr2){
        console.log(netSuiteErr2);
        return res.status(400).send({"status":400,"error":"Error while fetching inventoryNumber data from netsuite", netSuiteErr2});
    }

    let allDates = [...new Set(inputData.map((x)=>x.ordLoadDate))];
    console.log("Total dates found ", allDates.length);
    if(IRProcessName != ""){
        global.IRProcess.total = allCategory.length;
        global.IRProcess.completed = 0;
    }

    //Step 3 => setup log for each category
    for(let dateLoop=0;dateLoop<allDates.length;dateLoop++){
        let inventorydate = allDates[dateLoop];
        let itemData = inputData.filter((x)=>x.ordLoadDate == inventorydate);
        console.log("setup payload for load date "+  inventorydate + " total=>", itemData.length + "  ", new Date());

        let inventorydateDayjs = dayjs(inventorydate,'YYYYMMDD');
        let payload = inventoryAdjustmentPayload();
        payload.tranDate = inventorydateDayjs.format('YYYY-MM-DD') + "T0:00:00";
        
        //Step 4=> Fetch accounting period from supabase   => payload.postingPeriod = { "id": "63","refName": "Jun 2025"}; 
        console.log("fetching accounting period ", new Date());
        let { data : accPeriodData, error : supaErr1 } = await DBSuperBase.getAccountingPeriod(inventorydateDayjs.format('YYYY-MM-DD'));
        if(supaErr1){
            console.log(supaErr1);
            return res.status(400).send({"status":400,"error":"Error while fetching accounting period from supabase"});
        }
        else{
            if(accPeriodData.length > 0){
                payload.postingPeriod = { "id": accPeriodData[0].id,"refName": accPeriodData[0].periodname}; 
            }
            else{
                return res.status(400).send({"status":400,"error":"Error while fetching accounting period from supabase"});
            }
        }

        let totalRecords = itemData.length;
        let itemErrors = [];
        let itemSuccess = [];
        let itemForAdjustment = [];
        for(let loop=0;loop<totalRecords;loop++){
            let itemInternalID = 0;
            let itemId =  itemData[loop].ordItem;
            let newQty = itemData[loop].ordQty;
            let itemName = '';
            let casePackSize = 1;
            
            let netSuiteBalance = 0;
            let itemIndex = netSuiteItems.findIndex((x) => x.itemid == itemId);
            if(itemIndex > -1){
                let netSuiteQty = parseInt(netSuiteItems[itemIndex].totalquantityonhand||0);
                if(isNaN(netSuiteQty)) netSuiteQty= 0;
                if(netSuiteQty > 0){
                    let netSuiteCasePack = parseInt(netSuiteItems[itemIndex].custitemcase_pack);
                    if(isNaN(netSuiteCasePack)) netSuiteCasePack= casePackSize;
                    netSuiteBalance = netSuiteQty/ netSuiteCasePack;
                    //console.log(" ",JSON.stringify(netSuiteItems[itemIndex]) ," \n netSuiteQty ", netSuiteQty , " netSuiteCasePack ", netSuiteCasePack , " NetsuiteBal ", netSuiteBalance , " newQty", newQty ,  " diff", newQty - netSuiteBalance);
                }

                itemInternalID = parseInt(netSuiteItems[itemIndex].id||0);
                if(isNaN(itemInternalID)) itemInternalID= 0;

                itemName = netSuiteItems[itemIndex].displayname;
            }
            
            //netsuite 2000 and supabase 1850 then adjustment = 1850 - 2000 = -150
            //netsuite 2000 and supabase 2020 then adjustment = 2020 - 2000 = 20
            let totalAdjQty = newQty - netSuiteBalance;
            let inventoryNumberIndex = -1;
            let inventoryNumberData = netSuiteInventoryNumber.filter((x) => x.item == itemInternalID);
            if(inventoryNumberData.length > 0){
                inventoryNumberIndex = 0;
                if(inventoryNumberData.length > 1){
                    let checkSameItemERMSIndex = inventoryNumberData.findIndex((x)=>x.inventorynumber == itemId +"-ERMS");
                    if(checkSameItemERMSIndex > -1){
                        inventoryNumberIndex = checkSameItemERMSIndex;
                    }
                }
            }

            if(itemInternalID == 0 || itemIndex == -1 || totalAdjQty == 0 || (totalAdjQty < 0 && inventoryNumberIndex == -1)){
                let itemError = 'Item# '+ itemId + ' '+ (itemInternalID ==0?" => missing item internal ID":"")  +
                            (itemIndex == -1?" => missing item at netsuite level":"") +
                            (totalAdjQty == 0?" => No adjustment required":"") +
                            ((totalAdjQty < 0 && inventoryNumberIndex == -1)?" => Serial/Lot Number required defined for negative adjustment":"")
                //console.log(itemError);
                itemErrors.push({"inventory_date": inventorydate,"item_id":itemId,"quantity":newQty,"message":itemError});
                continue;
            }
            else{
                itemErrors.push({"inventory_date": inventorydate,"item_id":itemId,"quantity":newQty,"message":"success"});
            }
            
            let invAdjItem = {};
            if(inventoryNumberIndex > -1){
                invAdjItem = {"issueInventoryNumber": { "id": inventoryNumberData[inventoryNumberIndex].id}};
            }

            itemForAdjustment.push({
                    "adjustQtyBy": totalAdjQty,
                    "inventoryDetail": {
                        "inventoryAssignment": {
                            "items": [
                                {
                                    ...invAdjItem,
                                    "receiptInventoryNumber": itemId +"-ERMS",
                                    "quantity": totalAdjQty
                                }
                            ]
                        },
                        "item": {
                            "id": itemInternalID              
                        },
                        "location": {
                            "id": "30"
                        },
                        "quantity": totalAdjQty
                    },
                    "item": {
                        "id": itemInternalID
                    },
                    "line": (itemForAdjustment.length  + 1),
                    "location": {
                        "id": "30"
                    },
                    "memo": "IR-"+ itemId +"-"+  inventorydate
            })
        }
        
        let invAPISuccess = false; 
        if(itemForAdjustment.length > 0){
            payload.memo =  "IR-" + inventorydate;
            payload.inventory = {"items":itemForAdjustment};

            console.log("call inventory adjustment api for date "+  inventorydate + " ", new Date());
            try{
                const methodType = 'POST';
                const postURL = Util.getBaseRestURL(apiServer) + 'inventoryAdjustment';
                const headers = Util.createOAuthHeader(postURL, methodType, apiServer);

                const response = await axios.post(postURL, payload, {headers: headers});
                const dataJSON = await response;
                invAPISuccess = true; 
                finalResponse.push({"status":200,"date": inventorydate,"error":"","message":"Record generated successfully","issueItems": itemErrors});
            }
            catch(e){
                if (e.response) {
                    // console.error('NetSuite API Error Response:');
                    // console.error('Status:', e.response.status);
                    console.error('Data:', e.response.data);
                    const firstErrorDetail = e.response.data["o:errorDetails"][0];
                    finalResponse.push({"status":400,"date": inventorydate,"error":"Error while saving item adjustment -"+ firstErrorDetail?.detail,"message":"","issueItems": itemErrors,"payload":payload});
                }
                else {
                    // Error in setting up the request
                    console.error('Error creating NetSuite API request ',e?.message);
                    finalResponse.push({"status":400,"date": inventorydate,"error":"Error while saving item adjustment -"+ e?.message,"message":"","issueItems": itemErrors,"payload":payload});
                }
            }
            finalResponse.push({"status":200,"date": payload,"error":"","message":"Record generated successfully","issueItems": itemErrors});
        }
        else{
            finalResponse.push({"status":200,"date": inventorydate,"error":"","message":"No adjustment for date "+ inventorydate,"issueItems": itemErrors});
        }

        if(invAPISuccess == false){
            itemErrors.forEach((d) => {
                if(d.message == 'success'){
                    d.message = 'Netsuite API Request failed'
                }
            });
        }

        //Save each item log for request
        console.log("save inventory adjustment each item log for "+  inventorydate + " ", new Date());
        let { data : apiLogData, error : errLog } = await DBSuperBase.saveInventoryAdjustmentAPILog(itemErrors);
        if(errLog){
            console.log(errLog);
        }

        if(IRProcessName != ""){
            global.IRProcess.completed = dateLoop + 1;
        }
    }
    return res.status(200).send({"message":"OK","data_response":finalResponse});
}

exports.testAPI = async (req, res) => {
    let {errorMessage, allData} = await commonMaster.viewNetSuiteData('inventoryNumber',DEFAULT_API_SERVER);
    if(errorMessage){
        return res.status(400).send({"status":400,"error":errorMessage});
    }
    return res.status(200).send({"status":200,"data":allData});
}

exports.inventoryAdjustmentCategory = async (req, res) => {
    let invoiceDate = req.body.inventorydate||'20250101';
    
    let { data , error : supaErr1 } = await DBSuperBase.getInventoryAdjCategory(invoiceDate);
    if(supaErr1){
        console.log(supaErr1);
        return res.status(400).send({"status":400,"error":"Error while fetching category from supabase"});
    }
    else{
        return res.status(200).send({"status":200,"data":data});
    }
}

exports.inventoryAdjustmentLog = async (req, res) => {
    let startDate = req.body.start||'';
    let endDate = req.body.end||'';
    
    startDate = dayjs(startDate,'YYYY-MM-DD HH:mm:ss');
    endDate = dayjs(endDate,'YYYY-MM-DD HH:mm:ss');

    let { data , error : supaErr1 } = await DBSuperBase.getInventoryAdjustmentAPILog(startDate.toISOString(),endDate.toISOString());
    if(supaErr1){
        console.log(supaErr1);
        return res.status(400).send({"status":400,"error":"Error while fetching category from supabase"});
    }
    else{
        return res.status(200).send({"status":200,"data":data});
    }
}


exports.importFrankyProcess = async(req,res)=>{
    let inventorydate = (req.body.date||'').replace(/-/g,'');
    let inventorydateDayjs;
    if(inventorydate == ''){
        return res.status(400).json({
            "status": 400,
            "message": "Please provide inventory date parameter"
        });
    }
    else{
        inventorydateDayjs = dayjs(inventorydate,'YYYYMMDD');
        if(inventorydateDayjs.format('YYYYMMDD') != inventorydate){
            return res.status(400).json({
                "status": 400,
                "message": "Please provide valid date parameter"
            });
        }
    }

    let Agentic_WebhookURL = config.AGENTIC_FRANKY_IMPORT;
    // Request options
    const agent = new https.Agent({  
     rejectUnauthorized: false  
    });
    axios.defaults.httpsAgent = agent;
    /* month_year: June 2025.xlsx
        month_day: June 26
        full_trunc: 20250626
        full_date: June 26th 2025*/

    let payload ={
        month_year: inventorydateDayjs.format("MMMM YYYY") + ".xlsx",
        month_day: inventorydateDayjs.format("MMMM DD"),
        full_trunc: inventorydateDayjs.format("YYYYMMDD"),
        full_date: inventorydateDayjs.format("MMMM Do YYYY")
    }

    try{
        const response = await axios.post(Agentic_WebhookURL, payload);
        //console.log(response);
    }
    catch(e){
        console.log(e.message);
        return res.status(400).send({"status":"400","message":"Error while calling agentic workflow url"});
    }
    
    return res.status(200).send({"status":"200","message":"OK"});
}

exports.warehouseCutProcess = async(req, res)=>{
    let inventorydate = (req.body.date||'').replace(/-/g,'');
    let inventorydateDayjs;
    if(inventorydate == ''){
        return res.status(400).json({
            "status": 400,
            "message": "Please provide date parameter"
        });
    }
    else{
        inventorydateDayjs = dayjs(inventorydate,'YYYYMMDD');
        if(inventorydateDayjs.format('YYYYMMDD') != inventorydate){
            return res.status(400).json({
                "status": 400,
                "message": "Please provide valid date parameter"
            });
        }
    }

    let Agentic_WebhookURL = config.AGENTIC_WAREHOUSE_CUT;

    // Request options
    const agent = new https.Agent({rejectUnauthorized: false});
    axios.defaults.httpsAgent = agent;

    let payload ={
        full_trunc: inventorydateDayjs.format("YYYYMMDD"),
        full_date: inventorydateDayjs.format("MMMM Do YYYY")
    }

    try{
        const response = await axios.post(Agentic_WebhookURL, payload);
        //console.log(response);
    }
    catch(e){
        console.log(e.message);
        return res.status(400).send({"status":"400","message":"Error while calling agentic workflow url"});
    }
   
    let global_variable = Util.generateUniqueId(12);
    global.IRProcess = {"name": global_variable, "total": -1,"completed":0,"start":new Date().getTime()};
    res.status(200).send({"status":200,"message":"OK","total": -1,"completed":0,"name":global_variable})
}

exports.inventoryReliefProgress = async(req,res)=>{
    let name = (req.body.name||'');
    let IRPRocess = global.IRProcess;
    console.log(IRPRocess);
    if(IRPRocess){
        if(name !== IRPRocess.name){
            return res.status(400).send({"status":400,"message":"Import progress monitor details not found"});
        }

        //logic if still waiting for agentic to call url from last 2 min then stop it
        if(IRPRocess.total == -1){
            let curTime = new Date().getTime();
            const diffInMs = Math.abs(curTime - IRPRocess.start);
            // Convert milliseconds to seconds
            const diffInSeconds = Math.floor(diffInMs / 1000);
            //If waiting from 2 minutes then end it
            if(diffInSeconds > 120){
                return res.status(400).send({"status":400,"message":"Import progress mointor failed due to timeout"});
            }
        }
        res.status(200).send({"status":200,"data":IRPRocess});
    }
    else{
        return res.status(400).send({"status":400,"data":"Import progress data missing"});
    }
}