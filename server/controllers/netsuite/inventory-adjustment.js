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

function createPurchaseOrderPayload(){
    let payloadStructure = {
        // "billAddressList": { 
        //     "id": "0"
        // },
        "customForm": {
            "id": "175",
            "refName": "Dora's Naturals  - Purchase Order"
        },
        "department": {
            "id": "25"
        },
        "dueDate": "2025-07-26",
        "entity": {
           // "id": "8060",
        },
        "item": {
        },
        "location": {
            "id": "30",
            "refName": "21 EMPIRE : 21 EMPIRE - DSD"
        },
        "memo": "",
        "orderStatus": {
            "id": "E",
            "refName": "E"
        },
        "prevDate": "2025-07-10",
        // "purchaseContract": {
        //     "id": "24623",
        //     "refName": "Purchase Contract #8"
        // },
        "subsidiary": {
            "id": "18",
            //"refName": "DORA'S NATURALS, INC."
        },
        "terms": {
            "id": "11",
            "refName": "NET 21"
        }
    }
    return payloadStructure;
}

function createPurchaseOrderReceiptPayload(){   
    let payloadStructure = {
        "createdFrom": {
            //"id": "32732",
        },
        "custbody_broken_dirty": {
            "id": "1",
            "refName": "Yes"
        },
        "custbody_carrier": "-",
        "custbody_clean_trialer": {
            "id": "1",
            "refName": "Yes"
        },
        "custbody_damaged_materials": {
            "id": "2",
            "refName": "No"
        },
        "custbody_food_product_shipped": {
            "id": "1",
            "refName": "Yes"
        },
        "custbody_foul_odor": {
            "id": "1",
            "refName": "Yes"
        },
        "custbody_product_temp": 0.0,
        "custbody_rodent_activity": {
            "id": "2",
            "refName": "No"
        },
        "custbody_seal_locked": "yes",
        "custbody_trailer": "-",
        "custbody_truck_temp": 0.0,
        "customForm": {
            "id": "168",
            "refName": "Dora's Natural  - Item Receipt"
        },
        "department": {
            "id": "25",
            "refName": "1 - DISTRIBUTION"
        },
        "entity": {
            //"id": "8060",
        },
        "item": {
            "items": [
            ]
        },
        "landedCostMethod": {
            "id": "WEIGHT",
            "refName": "Weight"
        },
        "location": {
            "id": "30",
            "refName": "21 EMPIRE : 21 EMPIRE - DSD"
        },
        "orderId": 0,
        "prevDate": "",
        "subsidiary": {
            "id": "18",
            //"refName": "DORA'S NATURALS, INC."
        }
    }

    return payloadStructure;
}

exports.importPO = async (req, res) => {
    let apiServer = DEFAULT_API_SERVER;
    let poDuedate = (req.body.date||'').replace(/-/g,'');
    //poDuedate = '20250705';

    let podateDayjs;
    if(poDuedate == ''){
        return res.status(400).json({
            "status": 400,
            "message": "Please provide date parameter"
        });
    }
    else{
        podateDayjs = dayjs(poDuedate,'YYYYMMDD');
        if(podateDayjs.format('YYYYMMDD') != poDuedate){
            return res.status(400).json({
                "status": 400,
                "message": "Please provide valid date parameter"
            });
        }
    }
    
    //Step 1=> Fetch Purchase order which will need to be imported
    poDuedate = podateDayjs.format('M/D/YYYY');
    console.log("fetching production purchase order due for selected date ("+ poDuedate + ") at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr, allData : allPOData} = await commonMaster.viewNetSuiteData('PROD-PURCHASE-ORDER-SEARCH','PROD',{'selDay':poDuedate});
    if(netSuiteErr){
        console.log(netSuiteErr);
        return res.status(400).send({"status":400,"error":"Error while fetching purchase orders from production "+ netSuiteErr});
    }
    else if(allPOData.length == 0){
        return res.status(400).send({"status":400,"error":"No purchase order to delivered for selected date (" +  poDuedate +")"})
    }

    //Step 2 => Fetch vendor information from SB1 server for default billing address id to set at purchase order level
    let {errorMessage:netSuiteErr2, allData : vendorData} = await commonMaster.viewNetSuiteData('VENDOR-ADDRESS-INFO-SEARCH',apiServer);
    if(netSuiteErr2){
        console.log(netSuiteErr2);
        return res.status(400).send({"status":400,"error":"Error while fetching vendors information "+ netSuiteErr2});
    }

    //Step 3 => fetch items master with totalquantityonhand at Netsuite level
    console.log("fetching Production server items master at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr3, allData : NetSuiteItemsProd} = await commonMaster.viewNetSuiteData('ITEM-STOCK','PROD');
    if(netSuiteErr3){
        console.log(netSuiteErr3); 
        return res.status(400).send({"status":400,"error":"Error while fetching production item data from netsuite "+ netSuiteErr3});
    }

    console.log("fetching SB1 server items master at Netsuite level ", new Date());
    let {errorMessage:netSuiteErr4, allData : netSuiteItemsSB1} = await commonMaster.viewNetSuiteData('ITEM-STOCK',apiServer);
    if(netSuiteErr4){
        console.log(netSuiteErr4);
        return res.status(400).send({"status":400,"error":"Error while fetching sb1 server item data from netsuite "+ netSuiteErr4});
    }

    //Step 4=> Fetch Purchase order log from supabase for duedate
    let {error:netSuiteErr5, data : poTransferLogData} = await DBSuperBase.getPOTransferAPILog(poDuedate);
    if(netSuiteErr5){
        console.log(netSuiteErr5);
        return res.status(400).send({"status":400,"error":"Error while fetching purchase order log from supabase "+ netSuiteErr5});
    }


    let global_variable = Util.generateUniqueId(12);
    let totalRecords = allPOData.length;//totalRecords=6;
    global.POProcess[global_variable] = {"total":totalRecords,"completed":0,"start":new Date().getTime()};
    res.status(200).send({"status":200,"total":totalRecords,"completed":0,"name":global_variable,"message":"OK"});

    for(let loop=0;loop<totalRecords;loop++){
        console.log(`processing po#${loop + 1} / ${totalRecords}`);
        
        let poId = allPOData[loop].purchase_order_id;
        let curRecordID = 0;

        let poTransferLog = poTransferLogData.filter((x)=>x.prod_id == poId);
        if(poTransferLog && poTransferLog.length > 0){
            let poWithReceiptCreated = false;
            poTransferLog.forEach((x)=>{
                if(x.po_api_result == 'Success' && x.itemreceipt_api_result == 'Success'){
                    poWithReceiptCreated = true;
                }
                else if(x.po_api_result == 'Success'){
                    curRecordID = x.sb1_po_id;
                }
            });

            if(poWithReceiptCreated){
                console.log("PO already processed for ", poId);
                if(global_variable != ""){
                    global.POProcess[global_variable].completed = loop + 1;
                }
                continue;
            }
        }
        
        let po_transfer_log ={"prod_id":poId,"duedate":poDuedate,"tranid":"","po_payload":"","po_api_result":"","sb1_po_id":0,"itemreceipt_payload":"","itemreceipt_api_result":"","message":"Failed"};
        let {errorMessage:netSuitePOErr2, allData : poDetailData} = await commonMaster.getNSRestJSON('purchaseorder','PROD',poId);
        if(netSuitePOErr2){
            console.log(netSuitePOErr2);
            po_transfer_log.po_api_result = "Failed to fetch PO detail from production"; 
        }
        else if(poDetailData.id){ //Means we got purchase order data
            let poPayload =  createPurchaseOrderPayload();
            poPayload.dueDate = poDetailData.dueDate;
           
            let vendorIndex = vendorData.findIndex((x)=>x.vendor_id == poDetailData.entity.id);
            if(vendorIndex> -1){
                poPayload.entity = {"id":poDetailData.entity.id};
                if(vendorData[vendorIndex].address_id)poPayload.billingaddress = vendorData[vendorIndex].address_id;
            }
            else{
                vendorIndex = vendorData.findIndex((x)=>x.vendor_code == poDetailData.entity.refName);
                if(vendorIndex> -1){
                    poPayload.entity = {"id":vendorData[vendorIndex].vendor_id};
                    if(vendorData[vendorIndex].address_id)poPayload.billingaddress =vendorData[vendorIndex].address_id;
                }
            }

            if(vendorIndex > - 1){
                poPayload.memo = "PROD PO# "+ poDetailData.id +  "  | tranId :"+ poDetailData.tranId;
                poPayload.prevDate = poDetailData.prevDate;
                poPayload.shipDate = poDetailData.shipDate;
                //poPayload.terms =  { id:""}

                let poItems =  [];
                let poItemReceipt = [];
                poDetailData.item.items.forEach((d) => {
                    let itemIndex = NetSuiteItemsProd.findIndex((x) => x.id == d.item.id);
                    let itemInternalID = 0;
                    let itemId = '';
                    let netSuiteItemInActive = 'F';
                    if(itemIndex > -1){
                        itemIndex = netSuiteItemsSB1.findIndex((x) => x.itemid == NetSuiteItemsProd[itemIndex].itemid);
                        if(itemIndex > -1){
                            netSuiteItemInActive = netSuiteItemsSB1[itemIndex].isinactive;
                            itemInternalID = parseInt(netSuiteItemsSB1[itemIndex].id);
                            itemId = netSuiteItemsSB1[itemIndex].itemid;
                        }
                    }

                    if(itemInternalID > 0){
                        let itemQty = parseFloat(d.quantity);
                        if(isNaN(itemQty)) itemQty = 0;
                        let itemQtyReceived = parseFloat(d.quantityReceived);
                        if(isNaN(itemQtyReceived)) itemQtyReceived = 0;

                        if(itemQty > 0 || itemQtyReceived > 0){
                            if(itemQty < itemQtyReceived)itemQty = itemQtyReceived;
                            poItems.push({
                                "item": {
                                    "id": itemInternalID
                                },
                                "quantity": itemQty
                            });
                            
                            if(itemQtyReceived > 0){
                                poItemReceipt.push({
                                    "inventoryDetail": {
                                        "inventoryAssignment": {
                                            "items": [
                                                {
                                                    //"expirationDate": "2025-07-24",
                                                    "inventoryStatus": {
                                                        "id": "1",
                                                        "refName": "Good"
                                                    },
                                                    "quantity": itemQtyReceived,
                                                    "receiptInventoryNumber": itemId +"-ERMS"
                                                }
                                            ]
                                        },
                                        "quantitytobereceived": itemQtyReceived
                                    },               
                                    "itemReceive": true,
                                    "orderLine": poItems.length,
                                    "quantity": itemQtyReceived
                                });
                            }
                            else{
                                poItemReceipt.push({
                                    "itemReceive": false,
                                    "orderLine": poItems.length,
                                });
                            }
                        }
                    }
                });
                poPayload.item = {"items":poItems};
                
                po_transfer_log.tranid = poDetailData.tranId;
                po_transfer_log.po_payload = JSON.stringify(poPayload);

                //console.log(JSON.stringify(poPayload));
                if(curRecordID == 0){
                    if(poItems.length > 0){
                        console.log("call create purchase order api for "+  loop + " ", new Date());
                        try{
                            const methodType = 'POST';
                            const postURL = Util.getBaseRestURL(apiServer) + 'purchaseorder';
                            const headers = Util.createOAuthHeader(postURL, methodType, apiServer);

                            const response = await axios.post(postURL, poPayload, {headers: headers});
                            const dataJSON = await response;
                            
                            if (dataJSON.status == 204 || dataJSON.ok) {
                                let locURL = dataJSON.headers.get('Location')||'';
                                console.log("New record added at "+ locURL);
                                curRecordID = parseInt(locURL.replace(postURL,'').replace('/',''));
                                if(isNaN(curRecordID)) curRecordID = '';
                                console.log("New record curRecordID "+ curRecordID);    
                                
                                po_transfer_log.po_api_result = 'Success';
                                po_transfer_log.sb1_po_id = curRecordID;
                            }
                        }
                        catch(e){
                            console.log(JSON.stringify(poPayload));
                            if (e.response) {
                                console.error('Data:', e.response.data);
                                po_transfer_log.po_api_result = JSON.stringify(e.response.data); 
                            }
                            else {
                                // Error in setting up the request
                                console.error('Error creating NetSuite API request ',e?.message);
                                po_transfer_log.po_api_result = 'Error creating NetSuite API request ',e?.message; 
                            }
                        }
                    }
                    else{
                        console.log("No item received for po ");
                        po_transfer_log.po_api_result = "No item received for po "; 
                    }
                }
                else{
                    po_transfer_log.po_api_result = 'Success';
                    po_transfer_log.sb1_po_id = curRecordID;
                }

                if(curRecordID >0){
                    console.log("call create PO Receipt api for "+  loop + " ", new Date());
                    let poReceiptPayload = createPurchaseOrderReceiptPayload();
                    poReceiptPayload.orderId = curRecordID;
                    poReceiptPayload.createdFrom = {id:curRecordID};
                    poReceiptPayload.entity = poPayload.entity;
                    poReceiptPayload.prevDate = poPayload.prevDate;
                    poReceiptPayload.tranDate = poPayload.prevDate;
                    poReceiptPayload.item = {"items": poItemReceipt};
                    po_transfer_log.itemreceipt_payload = JSON.stringify(poReceiptPayload);
                    
                    try{
                        const methodType = 'POST';
                        const postURL = Util.getBaseRestURL(apiServer) + 'purchaseorder/'+ curRecordID +'/!transform/itemreceipt';
                        console.log(postURL);
                        const headers = Util.createOAuthHeader(postURL, methodType, apiServer);

                        const response = await axios.post(postURL, poReceiptPayload, {headers: headers});
                        await response;//const dataJSON = await response;
                        po_transfer_log.itemreceipt_api_result = 'Success';
                    }
                    catch(e){
                        console.log(JSON.stringify(poReceiptPayload));
                        if (e.response) {
                            console.error('Data:', e.response.data);
                            po_transfer_log.itemreceipt_api_result = e.response.data; 
                        }
                        else {
                            console.error('Error creating PO receipt NetSuite API request ',e?.message);
                            po_transfer_log.itemreceipt_api_result = 'Error creating PO receipt NetSuite API request ',e?.message; 
                        }
                    }
                }
            }
            else{
                console.log("Vendor not found for ", poDetailData.entity.id , "  refName :", poDetailData.entity.refName);
                po_transfer_log.po_api_result = "Failed to fetch Vendor for po"; 
            }

            
            if(po_transfer_log.po_api_result == 'Success' && po_transfer_log.itemreceipt_api_result == 'Success'){  
                po_transfer_log.message = "Success";
            }
            //Save PO transfer log
            let { error : errLog } = await DBSuperBase.savePOTransferAPILog(po_transfer_log);
            if(errLog){
                console.log(errLog);
            }

            if(global_variable != ""){
                global.POProcess[global_variable].completed = loop + 1;
            }
        }
    }
    console.log("---- PO Import completed -----")
}

exports.POImportProgress = async(req,res)=>{
    let name = (req.body.name||'');
    if(global.POProcess && global.POProcess[name]){
        return res.status(200).send({"status":200,"data":global.POProcess[name]});
    }
    else{
        return res.status(400).send({"status":400,"message":"Import progress data missing"});
    }
}