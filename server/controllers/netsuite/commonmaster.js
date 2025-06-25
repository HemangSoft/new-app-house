'use strict';
const axios= require('axios');
const config = require('..//..//helpers//config.js');
const Util = require('..//..//helpers//util.js');
const oracleKeyWords = ['type','number','void','group']
const DEFAULT_API_SERVER = Util.getDefaultAPIServer();

async function viewNetSuiteData(netSuiteTableName,apiServer){
    let allData = [];
    let errorMessage = null;
    const methodType = 'POST';
    let requestURL = Util.getBaseSuiteQLURL(apiServer);

    let hasMoreRecord = true;
    while(hasMoreRecord){
        let query = '';
        let whereCondition = '';
        if(netSuiteTableName.toUpperCase() =='ITEM-STOCK'){
            query = `SELECT id,displayname,itemid,location,vendorname,totalquantityonhand,stockunit, weightunits,custitemcase_pack from ITEM Order by ID`;
        }
        else{
            if(allData.length > 0){
                // whereCondition = " Where ID >"+ allData[allData.length - 1].id;
                await Util.customDelay(500); 
            }
            if(netSuiteTableName.toUpperCase() == "ITEM"){
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
        }
        catch(err){
            console.error(err);
            errorMessage = "Error while fetching data";
            hasMoreRecord = false;
        }
    }

    return {errorMessage, allData}
}
exports.viewNetSuiteData = viewNetSuiteData;
