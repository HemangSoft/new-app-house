const { createClient } = require('@supabase/supabase-js/dist/main/index.js');
const config = require('.//config.js');


class DBSuperBase {
    constructor() { 
         this.supabaseInvRelief = createClient(config.SUPABASE_INV_URL, config.SUPABASE_INV_PASS);
    }

    getExcelValidation = async function(inventory_date,categoryList){
        let allRecords = [];
        let error2 = null;
        let offset = 0;
        let batchSize =  1000;
        
        while (true) {
            const { data, error } = await this.supabaseInvRelief
                            .from('excel_validation')
                            .select('*')
                            .eq('inventory_date', inventory_date)
                            .in('category', categoryList)
                            .range(offset, offset + batchSize - 1);
            if (error) {
                error2 = error;
                console.error('Error fetching records:', error);
                break;
            }

            if (!data || data.length === 0) {
                break; // Stop when no more records are found
            }
        
            allRecords = allRecords.concat(data);
            offset += batchSize;
        }
        
        return { data : allRecords, error : error2 };
    }

    getAccountingPeriod = async function(inventory_date){
        //console.log("inventory_date ", inventory_date);
        const { data, error } = await this.supabaseInvRelief
            .from('netsuite_accounting_period')
            .select('*')
            .eq('isposting', 'T')
            .lte('startdate', inventory_date)
            .gte('enddate', inventory_date);
            
        if(error){
            console.log(error);
            return {error:error,data:[]}
        }
        else{
            return {error:null,data:data};
        }
    }

    saveInventoryAdjustmentAPILog = async function(itemLogArray){
        const { data, error } = await this.supabaseInvRelief
            .from('inventory_api_item_log')
            .insert(itemLogArray)
        if(error){
            console.log(error);
            return {error:error,result:[]}
        }
        else{
            return {error:null,result:data};
        }
    }

    getInventoryAdjCategory = async function(inventory_date){
        const { data, error } = await this.supabaseInvRelief.rpc('get_category_excel_validation', {p_date: inventory_date});
        return { data , error };
    }

    getInventoryAdjustmentAPILog = async function(startDate,endDate){
        console.log(startDate,endDate);
        const { data, error } = await this.supabaseInvRelief
            .from('inventory_api_item_log')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('id', { ascending: false });
        return { data , error };
    }

    savePOTransferAPILog = async function(itemLogArray){
        const { data, error } = await this.supabaseInvRelief
            .from('po_transfer_log')
            .insert(itemLogArray)
        if(error){
            console.log(error);
            return {error:error,result:[]}
        }
        else{
            return {error:null,result:data};
        }
    }

    getPOTransferAPILog = async function(dueDate){
        const { data, error } = await this.supabaseInvRelief
            .from('po_transfer_log')
            .select('prod_id,tranid,po_api_result,sb1_po_id,itemreceipt_api_result,message')
            .eq('duedate', dueDate)
            .order('created_at', { ascending: false });
        return { data , error };
    }
}

module.exports = new DBSuperBase();