'use strict';
const axios= require('axios');
const config = require('..//..//helpers//config.js');
const Util = require('..//..//helpers//util.js');
const oracleKeyWords = ['type','number','void','group']
const DEFAULT_API_SERVER = Util.getDefaultAPIServer();

async function viewNetSuiteData(netSuiteTableName,apiServer,recordId = null){
    let allData = [];
    let errorMessage = null;
    const methodType = 'POST';
    let requestURL = Util.getBaseSuiteQLURL(apiServer);

    let tableNameUpperCase = netSuiteTableName.toUpperCase();
    let hasMoreRecord = true;
    while(hasMoreRecord){
        let query = '';
        let whereCondition = '';
        if(tableNameUpperCase =='ITEM-STOCK'){
            query = `SELECT id,displayname,itemid,location,vendorname,totalquantityonhand,stockunit, weightunits,custitemcase_pack,isinactive from ITEM Order by ID`;
        }
        else if(tableNameUpperCase =='INVENTORYNUMBER-STOCK'){
            query = `SELECT invnum.id AS inventorynumber_id, invnum.inventorynumber, item.itemid, invloc.location AS location_id,    loc.name AS location_name,
                        invloc.quantityavailable,invloc.quantityonhand,invloc.quantityonorder
                    FROM  inventorynumber invnum
                    JOIN inventorynumberlocation invloc ON invloc.inventorynumber = invnum.id
                    JOIN item ON invnum.item = item.id
                    JOIN location loc ON invloc.location = loc.id
                    WHERE item.id = ${recordId}
                    ORDER BY  invnum.inventorynumber, location_name`;
        }
        else if(tableNameUpperCase =='PROD-PURCHASE-ORDER-SEARCH'){
            /*
            //Below query is for select purcahse order received in last 3 days
            query = `SELECT po.id AS purchase_order_id, po.tranid AS transaction_number, po.trandate AS transaction_date, po.entity AS vendor_id, po.status AS po_status,v.entityid as vendor
                        FROM transaction po 
                        JOIN vendor v ON po.entity = v.id
                        WHERE po.type = 'PurchOrd' 
                        AND po.id in (select tl.createdfrom from transaction ir 
                        join transactionline tl on ir.id=tl.transaction
                        Where  ir.type = 'ItemRcpt' and ir.trandate BETWEEN TO_DATE('${recordId.start_date}', 'YYYY-MM-DD') AND TO_DATE('${recordId.end_date}', 'YYYY-MM-DD')) order by po.id`;
            */

            query = `SELECT po.id AS purchase_order_id, po.tranid AS transaction_number, po.trandate AS transaction_date, po.entity AS vendor_id, po.status AS po_status,v.entityid as vendor
                        FROM transaction po 
                        JOIN vendor v ON po.entity = v.id
                        WHERE po.type = 'PurchOrd' 
                        and po.status in ('D','E','F','G','H','I','J') and po.duedate in ('${recordId.selDay}')
                        order by po.id`;
        }
        else if(tableNameUpperCase =='VENDOR-ADDRESS-INFO-SEARCH'){
            query = `select  v.id AS vendor_id,v.entityid AS vendor_code,v.companyname AS vendor_name,v.defaultbillingaddress AS address_id from vendor v order by v.id`;
        }
        else{
            if(allData.length > 0){
                // whereCondition = " Where ID >"+ allData[allData.length - 1].id;
                await Util.customDelay(500); 
            }
            if(tableNameUpperCase == "ITEM"){
                whereCondition =" Where itemType='InvtPart'";
            }

            query = "SELECT * FROM "+ netSuiteTableName +  whereCondition;
        }
        console.log("viewNetSuiteData function => ", query);

        console.log(requestURL);
        let headers = Util.createOAuthHeader(requestURL, methodType,apiServer);
        const payload = JSON.stringify({
            q: query
        });
        try{ 
            // const response = await fetch(requestURL, {
            //                     headers: headers,
            //                     method: methodType,
            //                     body: payload
            //                 });await (pageURL,bodyPayload,{headers:requestHeaders});
            const response = await axios.post(requestURL, payload, {headers: headers});
            const data = await response.data;
            if(response.status == 400 || response.status == 401){
                console.error(data);
                errorMessage = "Error while fetching data";
                if(data["o:errorDetails"]){
                    if(data["o:errorDetails"][0].detail){
                        errorMessage = data["o:errorDetails"][0].detail;
                    }
                }
                hasMoreRecord = false;
            }
            else{
                //console.log(data.links);
                console.log("count =>", data.count);
                if(data.hasMore !== true) {
                    hasMoreRecord = false;
                }
                else{
                    if(netSuiteTableName.toUpperCase() != "CUSTOMERADDRESS"){
                        data.links.forEach((d)=>{
                            if(d.rel == 'next'){
                                requestURL = d.href;
                            }
                        });
                    }
                    // Next url failed with ERROR : Invalid login attempt. For more details, see the Login Audit Trail in the 
                    //  NetSuite UI at Setup > Users/Roles > User Management > View Login Audit Trail.
                }
                // Check if 'data' is an array, and if not, make it an array
                if (data.items && Array.isArray(data.items)) 
                {
                    allData = [...allData,...data.items];
                }
                else{
                    errorMessage = "Data is not in list format";
                }
            }
            //Warning HEMANG => Comment below line after testing
            //hasMoreRecord = false;
        }
        catch(err){
            errorMessage = "Error while fetching data";
            if (e.response) {
                console.error('Data:', e.response.data);
                let data = e.response.data;
                if(data["o:errorDetails"]){
                    if(data["o:errorDetails"][0].detail){
                        errorMessage = data["o:errorDetails"][0].detail;
                    }
                }
            }
            else {
                console.error('Error creating PO receipt NetSuite API request ',e?.message);
            }
            hasMoreRecord = false;
        }
    }

    return {errorMessage, allData}
}
exports.viewNetSuiteData = viewNetSuiteData;

async function getNSRestJSON(netSuiteTableName,apiServer,curRecordID){
    let allData = [];
    let errorMessage = null;
    const methodType = 'get';

    let requestURL = Util.getBaseRestURL(apiServer);
    let fetchURL = requestURL + netSuiteTableName + '/' + curRecordID +'?expandSubResources=true';
    console.log(fetchURL);

    let headers = Util.createOAuthHeader(fetchURL, methodType,apiServer);
    try{
        const response = await axios({method: 'get', url: fetchURL, headers: headers});
        const data = await response.data;
        //console.log(data);
        if(response.status == 400 || response.status == 401){
            console.error(data);
            errorMessage = "Error while fetching data";
            if(data["o:errorDetails"]){
                if(data["o:errorDetails"][0].detail){
                    errorMessage = data["o:errorDetails"][0].detail;
                }
            }
        }
        else{
            allData = data;
        }
    }
    catch(e){
        if (e.response) {
            console.error('Data:', e.response.data); //e.response.data["o:errorDetails"][0];
        }
        else {
            // Error in setting up the request
            console.error('Error NetSuite API request ',e?.message);
        }
        errorMessage = "Error while fetching data";
    }

    return {errorMessage, allData}
}
exports.getNSRestJSON = getNSRestJSON;