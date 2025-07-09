import apiClient from '../axios'

export async function fillFrankyCategory(inventorydate) {
  return apiClient
    .post('/v1/netsuite/inventoryadjustmentcategory', {
        "inventorydate": inventorydate.replace(/-/g,'')
    })
    .then(response => {
        if (response && response.data) {
            return response.data.data
        }
        return false
    })
    .catch(err => console.log(err))
}

export async function transferCategoryToNetsuite(inventorydate,selectedCategory) {
  return apiClient
    .post('/v1/netsuite/inventoryadjustment', {
        "inventorydate": inventorydate.replace(/-/g,''),
        "categoryList": selectedCategory,
        "ajaxupdate":1
    })
    .then(response => {
        if (response && response.data) {
            return response.data
        }
        return false
    })
    .catch(err => {
        // let err2 = JSON.parse(xhr.responseText);
        // if(err.message){
        //     console.log(err.message)
        // }
        // else{
        //     console.log("Some Error occur while processing, Please try again");
        // }
        console.log(err);
    });

}

export async function inventoryAdjustmentProgress(inventorydate,name) {
  return apiClient
    .post('/v1/netsuite/inventoryadjustmentprogress', {
        "inventorydate": inventorydate.replace(/-/g,''),
        "name": name
    })
    .then(response => {
        if (response && response.data) {
            return response.data.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}

export async function importFrankyProcess(importDate) {
  return apiClient
    .post('/v1/netsuite/importFrankyProcess', {
        "date": importDate.replace(/-/g,''),
    })
    .then(response => {
        if (response && response.data) {
            return response.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}

export async function warehouseCutProcess(importDate) {
  return apiClient
    .post('/v1/netsuite/warehousecutProcess', {
        "date": importDate.replace(/-/g,''),
    })
    .then(response => {
        if (response && response.data) {
            return response.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}

export async function inventoryReliefProgress(inventorydate,name) {
  return apiClient
    .post('/v1/netsuite/inventoryreliefprogress', {
        "inventorydate": inventorydate.replace(/-/g,''),
        "name": name
    })
    .then(response => {
        if (response && response.data) {
            return response.data.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}

export async function importPO(importDate) {
  return apiClient
    .post('/v1/netsuite/importPO', {
        "date": importDate.replace(/-/g,''),
    })
    .then(response => {
        if (response && response.data) {
            return response.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}


export async function POImportProgress(inventorydate,name) {
  return apiClient
    .post('/v1/netsuite/poimportprogress', {
        "inventorydate": inventorydate.replace(/-/g,''),
        "name": name
    })
    .then(response => {
        if (response && response.data) {
            return response.data.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}

export async function searchFrankyLog(startDateTime,endDateTime) {
  return apiClient
    .post('/v1/netsuite/inventoryadjustmentlog', {
        "start": startDateTime ,"end": endDateTime
    })
    .then(response => {
        if (response && response.data) {
            return response.data.data
        }
        return false
    })
    .catch(err => {
        console.log(err);
    });
}
