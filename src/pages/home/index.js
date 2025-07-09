/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useEffect, useCallback, useRef } from 'react'; 
//import { Link } from 'react-router-dom'; //useNavigate
//import classNames from 'classnames';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import { useSite } from '../../context/sitecontext';
//import * as commonService from './../../services/common.js';
import * as publicCommonService from './../../services/public/common.js';
import Footer from  './../../common/footer.js';

const Home = (props) =>{
    const { setIsLoading  } = useSite();
    const [ inventoryDate, setInventoryDate] = useState('');
    const [ frankyCategory, setFrankyCategory] = useState([])
    
    const progressInfoRef = useRef({showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''});
    const [syncProcessInfo,setSyncProcessInfo]= useState({syncPercentage:0,showProgress:false,total:0});
    const [syncProcessName,setSyncProcessName]= useState('');

    const [ logStartDate, setLogStartDate] = useState('');
    const [ logStartTime, setLogStartTime] = useState('');
    const [ logEndDate, setLogEndDate] = useState('');
    const [ logEndTime, setLogEndTime] = useState('');
    const [ logFilter, setLogFilter] = useState('issues');
    const [ dbLog, setDBLog] = useState([]);
    const [ displayDBLog, setDisplayDBLog] = useState([]);

    const fillData = ()=>{
        let todayDate = dayjs().format("YYYY-MM-DD");
        setInventoryDate(todayDate);
        fillCategory(todayDate);
    }

    const fillCategory  = async(selectedDate)=>{
        setFrankyCategory([]);

        if(selectedDate !== ""){
            setIsLoading(true);
            const result = await publicCommonService.fillFrankyCategory(selectedDate);
            if(result && result.length >0){
                result.forEach((d)=>{
                    d.checked = false;
                });
            
                setFrankyCategory(result);
            }
            setIsLoading(false);
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onLoadFillData = useCallback(fillData, []);
    useEffect(() => {
        onLoadFillData();
        return () => {
            
        };
    }, [onLoadFillData]);

    const handleChange = (e, fieldName,filter) =>{
        let searchValue = '';
        if(e && e.target){
            searchValue = (e.target.value||'');
        }
        else{
            searchValue = (e||'').toString()
        }
        if(fieldName === 'inventoryDate'){
            setInventoryDate(searchValue);
            fillCategory(searchValue);
        }
        else if(fieldName === 'logStartDate'){
            setLogStartDate(searchValue);
        }
        else if(fieldName === 'logStartTime'){
            setLogStartTime(searchValue);
        }
        else if(fieldName === 'logEndDate'){
            setLogEndDate(searchValue);
        }
        else if(fieldName === 'logEndTime'){
            setLogEndTime(searchValue);
        }
        else if(fieldName === 'ddlMessageFor'){
            setLogFilter(searchValue);
            filterLogResult(searchValue, dbLog);
        }
    }

    const handleCheckboxChange= (index) => {
        const updated = [...frankyCategory];
        updated[index].checked = !updated[index].checked;
        setFrankyCategory(updated);
    };

    const selectUnSelectAllCategory = (selectAll)=>{
        const updated = [...frankyCategory];
        updated.forEach((d)=>{
            d.checked = selectAll;
        })
        setFrankyCategory(updated);
    }

    const transferCategoryToNetsuite = async()=>{
        let selectedCategory = [];
        if(inventoryDate ===""){
            toast.error('Please select date');
            return;
        }

        frankyCategory.forEach((d)=>{
            if(d.checked === true){
                selectedCategory.push(d.category);
            }
        });

        if(selectedCategory.length === 0){
            toast.error("Please select category to transfer");
            return;
        }

        setIsLoading(true);
        const result = await publicCommonService.transferCategoryToNetsuite(inventoryDate,selectedCategory);
        if(result){
            toast.success("Inventory adjustment transfer started");
            if(result.total > 0){
                let progressPercentage = {showProgress:true,total:result.total,completed:result.completed ,syncPercentage:0, name:result.name};
                progressInfoRef.current = progressPercentage;
                setSyncProcessInfo({showProgress:true,syncPercentage:0,total:0});
                setSyncProcessName("Transfer CC")
                updateCategoryImportProgress();
            }
        }
        setIsLoading(false);
    }

    const updateCategoryImportProgress = ()=>{
        setTimeout(()=>{getProcessAJAXCC()},5000);
    }

    const getProcessAJAXCC = async()=>{
        let progressPercentage =  {...progressInfoRef.current};
        try{
            const data = await publicCommonService.inventoryAdjustmentProgress(inventoryDate,progressInfoRef.current.name);
            if(data){
                let total = data.total;
                let completed = data.completed;

                let percentage = parseInt(((completed/ total) * 100).toString());
                if(percentage > 100) percentage = 100;

                if(completed < total){
                    progressPercentage.completed = completed;
                    progressPercentage.syncPercentage = percentage;
                    progressInfoRef.current = progressPercentage;
                    setSyncProcessInfo(progressPercentage);
                    updateCategoryImportProgress();
                } 
                else{
                   toast.success("Inventory adjustment transfer completed");
                   progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
                   setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
                   setSyncProcessName('');
                }
            }
        }
        catch{
            toast.error("Import Progress monitor failed");
            setSyncProcessName('');
            setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
            progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
        }
    }

    const importFrankyProcess = async()=>{
        if(inventoryDate ===""){
            toast.error('Please select date');
            return;
        }

        setIsLoading(true);
        const result = await publicCommonService.importFrankyProcess(inventoryDate);
        if(result && result.message){
            toast.success("Import Franky Process started");
        }
        setIsLoading(false);
    }

    const warehouseCutProcess = async()=>{
        if(inventoryDate ===""){
            toast.error('Please select load date');
            return;
        }

        let cutDate = dayjs(inventoryDate,'YYYYMMDD').add(-1,'day').format('YYYYMMDD');

        setIsLoading(true);
        const result = await publicCommonService.warehouseCutProcess(cutDate);
        if(result && result.message){
            toast.success("Warehouse Cut Process started");
            if(result.total === -1){
                let progressPercentage = {showProgress:true,total:result.total,completed:0,syncPercentage:0,name:result.name};
                progressInfoRef.current = progressPercentage;
                setSyncProcessInfo({showProgress:true,syncPercentage:0,total: -1});
                setSyncProcessName("Transfer IR");
                updateIRImportProgress();
            }
        }
        setIsLoading(false);
    }

    const updateIRImportProgress = ()=>{
        setTimeout(()=>{getProcessAJAXIR()},5000);
    }

    const getProcessAJAXIR = async()=>{
        let progressPercentage =  {...progressInfoRef.current};
        try{
            const data = await publicCommonService.inventoryReliefProgress(inventoryDate,progressInfoRef.current.name);
            if(data){
                let total = data.total;
                let completed = data.completed;

                let percentage = parseInt(((completed/ total) * 100).toString());
                if(percentage > 100) percentage = 100;

                if(completed < total || total === -1){
                    progressPercentage.completed = completed;
                    progressPercentage.syncPercentage = percentage;
                    progressPercentage.total = total;
                    progressInfoRef.current = progressPercentage;
                    setSyncProcessInfo({...progressPercentage,total:percentage});
                    updateIRImportProgress();
                } 
                else{
                   toast.success("Inventory Relief transfer completed");
                   progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
                   setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
                   setSyncProcessName('');
                }
            }
        }
        catch{
            toast.error("Import Relief monitor failed");
            setSyncProcessName('');
            setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
            progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
        }
    }

    const importPO = async()=>{
         if(inventoryDate ===""){
            toast.error('Please select date');
            return;
        }

        let impDate = dayjs(inventoryDate,'YYYYMMDD').format('YYYYMMDD');
        setIsLoading(true);
        const result = await publicCommonService.importPO(impDate);
        if(result && result.message){
            toast.success("Import Process started");
            if(result.total > 0){
                let progressPercentage = {showProgress:true,total:result.total,completed:result.completed ,syncPercentage:0, name:result.name};
                progressInfoRef.current = progressPercentage;
                setSyncProcessInfo({showProgress:true,syncPercentage:0,total:result.total});
                setSyncProcessName("Import PO")
                updatePOImportProgress();
            }
        }
        setIsLoading(false);
    }

    const updatePOImportProgress = ()=>{
        setTimeout(()=>{getProcessAJAXPO()},5000);
    }

    const getProcessAJAXPO = async()=>{
        let progressPercentage =  {...progressInfoRef.current};
        try{
            const data = await publicCommonService.POImportProgress(inventoryDate,progressInfoRef.current.name);
            if(data){
                let total = data.total;
                let completed = data.completed;

                let percentage = parseInt(((completed/ total) * 100).toString());
                if(percentage > 100) percentage = 100;

                if(completed < total){
                    progressPercentage.completed = completed;
                    progressPercentage.syncPercentage = percentage;
                    progressInfoRef.current = progressPercentage;
                    setSyncProcessInfo(progressPercentage);
                    updatePOImportProgress();
                }
                else{
                   toast.success("Import PO transfer completed");
                   progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
                   setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
                   setSyncProcessName('');
                }
            }
        }
        catch{
            toast.error("Import Progress monitor failed");
            setSyncProcessName('');
            setSyncProcessInfo({syncPercentage:0,showProgress:false,total:0});
            progressInfoRef.current = {showProgress:false,total:0,completed:0 ,syncPercentage:0, name:''};
        }
    }

    const searchFrankyLog  = async()=>{
        if(logStartDate ===""){
            toast.error('Please select start date');
            return;
        }
        if(logEndDate ===""){
            toast.error('Please select end date');
            return;
        }

        let startTime = logStartTime;
        let endTime = logEndTime;
        if(startTime ===""){
            startTime = '00:00';
        }
        if(endTime ===""){
            endTime = '23:59';
        }

        setDBLog([]);
        setDisplayDBLog([]);
        setIsLoading(true);
        const result = await publicCommonService.searchFrankyLog(logStartDate + " "+ startTime,logEndDate + " "+ endTime);
        if(result && result.length >0){
            result.forEach((d)=>{
                d.success = (d.message === 'success');
                d.created_at_display = formatDateToYMDHM(d.created_at);
            });
            setDBLog(result);
            filterLogResult(logFilter, result);
        }
        setIsLoading(false);
    }

    const formatDateToYMDHM = (isoDateStr)=>{
        const date = new Date(isoDateStr);

        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    const filterLogResult =(filterType,allData) =>{
        let allLogs = [...allData];
        if(filterType === 'issues'){
            allLogs = allLogs.filter((x) => x.success === false);
        }
        else if(filterType === 'success'){
            allLogs = allLogs.filter((x) => x.success === true);
        }
        setDisplayDBLog(allLogs);
    }

    return (
    <>
        <div className="text-center">
            <div className="fnt30-w800">Warehouse Adjustment Dashboard</div>
        </div>

        <div className="mt-2">
            <div className="row">
                <div className="col-6">
                    <div className="overflow-auto pt-0 mt-0">
                        <div className="card card-green">
                            <div className="card-img-top fnt24 card-cust-title">Payload Franky (Supabase to Netsuite) </div>
                            <div className="card-body p-2">
                                    <div className="container" style={{minHeight:"calc(-160px + 95vh)"}}>
                                        <div className="row">
                                            <div className="col-2"><label className="col-form-label">Date</label></div>
                                            <div className="col-8">
                                                <input type="date" id="inventoryDate" value={inventoryDate} onChange={(e)=> handleChange(e,'inventoryDate',true)} className="form-control" style={{width:"140px"}} />
                                            </div>
                                        </div>

                                        <div className="row mt-1">
                                            <div className="col-2">Category</div>
                                            <div className="col-10">
                                                <div className="position-relative w-100">
                                                    <div className="position-absolute" style={{right:"0px",top:"-26px"}}>
                                                        <button type="button" className="btn btn-link btn-sm" onClick={()=> selectUnSelectAllCategory(true)}>Select All</button>|<button type="button" className="btn btn-link btn-sm"  onClick={()=> selectUnSelectAllCategory(false)}>None</button>
                                                    </div>
                                                </div>
                                                <div id="dvCategory" style={{minHeight:"300px",maxHeight:"300px",overflowY:"auto","border":"1px solid #cacaca","padding":"6px"}}>
                                                    {frankyCategory.map((item, index) => (
                                                        <div key={index}>
                                                            <label>
                                                                <input type="checkbox" className="form-check-input" checked={item.checked} onChange={() => handleCheckboxChange(index)} />
                                                                {' '}{item.category}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="row mt-2 align-items-center">
                                            <div className="col-2"></div>
                                            <div className="col-3">
                                                <button type="button" className="btn btn-primary btn-sm w-100" onClick={()=> transferCategoryToNetsuite()}>Transfer to NetSuite</button>
                                            </div>
                                            <div className="col-2">
                                                <button type="button" className="btn btn-primary btn-sm w-100" onClick={()=> importFrankyProcess()}>Import Franky</button>
                                            </div>
                                            <div className="col-3">
                                                <button type="button" className="btn btn-primary btn-sm w-100" onClick={()=> warehouseCutProcess()}>Warehouse Cuts</button>
                                            </div>
                                            <div className="col-2">
                                                <button type="button" className="btn btn-primary btn-sm w-100" onClick={()=> importPO()}>Import PO</button>
                                            </div>
                                        </div>

                                        <div className="row mt-2 align-items-center" style={{minHeight:"25px"}}>
                                            <div className="col-2"><h6>{syncProcessName}</h6></div>
                                            <div className="col-10">
                                                {syncProcessInfo.showProgress === true &&
                                                    <div className="row align-items-center">
                                                        <div className="col-9">
                                                            <div class="progress">
                                                                <div class="progress-bar" role="progressbar" style={{width:progressInfoRef.current.syncPercentage + "%"}} 
                                                                    aria-valuenow={progressInfoRef.current.syncPercentage} aria-valuemin="0" aria-valuemax="100">
                                                                        {progressInfoRef.current.syncPercentage}%
                                                                        <div className="d-none">{syncProcessInfo.syncPercentage}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-3">
                                                            {syncProcessInfo.total > -1 && <>{progressInfoRef.current.completed} / { progressInfoRef.current.total}</>}
                                                            {syncProcessInfo.total === -1 && <><i className="fa fa-spin fa-spinner fa-1x" /> Waiting...</>}
                                                        </div>
                                                    </div>}
                                            </div>
                                        </div>
                                    </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-6">
                    <div className="card card-red">
                        <div className="card-img-top fnt24 card-cust-title">Supabase Franky Log</div>
                        <div className="card-body p-2">
                            <div className="pt-0 mt-0" style={{minHeight:"calc(-160px + 95vh)"}}>
                                <div className="container">
                                    <div className="row"> 
                                        <div className="col-2"><label className="col-form-label">Start Date</label></div>
                                        <div className="col-8">
                                            <input type="date" id="logStartDate" className="form-control d-inline-block" style={{width:"140px"}} value={logStartDate} onChange={(e)=> handleChange(e,'logStartDate',true)} />
                                            <input type="time" id="logStartTime" className="form-control d-inline-block" style={{width:"140px"}} value={logStartTime} onChange={(e)=> handleChange(e,'logStartTime',true)} />
                                        </div>
                                    </div>
                                    <div className="row pt-1">
                                        <div className="col-2"><label className="col-form-label">End Date</label></div>
                                        <div className="col-8">
                                            <input type="date" id="logEndDate" className="form-control d-inline-block" style={{width:"140px"}} value={logEndDate} onChange={(e)=> handleChange(e,'logEndDate',true)} />
                                            <input type="time" id="logEndTime" className="form-control d-inline-block" style={{width:"140px"}} value={logEndTime} onChange={(e)=> handleChange(e,'logEndTime',true)} />
                                        </div>
                                    </div>
                                    <div className="row pt-1">
                                        <div className="col-2"></div>
                                        <div className="col-4">
                                            <button type="button" className="btn btn-primary btn-sm" onClick={()=> searchFrankyLog()}>Search</button>
                                        </div>
                                        <div className="col-6">
                                            <div style={{width:"180px"}} className="ms-auto">
                                                <select id="ddlMessageFor" className="form-select" value={logFilter} onChange={(e)=> handleChange(e,'ddlMessageFor',true)}>
                                                    <option value="issues">Only issues</option>
                                                    <option value="success">Only success</option>
                                                    <option value="both">All</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row pt-1">
                                        <div className="col-12 pt-0 mt-0">
                                            <div className="overflow-auto pt-0 mt-0" style={{maxHeight:"calc(-289px + 95vh)",minHeight:"calc(-289px + 95vh)"}}>
                                                <table id="tblFLog" className="table table-sm table-hover stickyHeader stickyHeadergry">
                                                    <thead>
                                                        <tr className="fnt14-w500">
                                                            <th className="p-2">#</th>
                                                            <th className="p-2" style={{width:"110px"}}>Inventory Date</th>
                                                            <th className="p-2" style={{width:"80px"}}>Item ID</th>
                                                            <th className="p-2">Quantity</th>
                                                            <th className="p-2">message</th>
                                                            <th className="p-2">Created at</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {displayDBLog.map((item,index) =>
                                                            <tr key={'d-'+ index}>
                                                                <td>{index + 1}</td>
                                                                <td>{item.inventory_date}</td>
                                                                <td>{item.item_id}</td>
                                                                <td>{item.quantity}</td>
                                                                <td>{item.message}</td>
                                                                <td>{item.created_at_display}</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>  
        </div>
        
        <Footer />
    </>
  );
}
export default Home