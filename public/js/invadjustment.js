function createTodayDate(){
    var hoy = new Date(),
        d = hoy.getDate(),
        m = hoy.getMonth()+1, 
        y = hoy.getFullYear(),
        data;
    if(d < 10){
        d = "0"+d;
    };
    if(m < 10){
        m = "0"+m;
    };
    return y+"-"+m+"-"+d;
}
$(document).ready(function(){
    let todayDate = createTodayDate()
    $("#payloadDate").change(function(){
        fillCategory($(this).val());
    })
    $("#payloadDate").val(todayDate);
    fillCategory(todayDate);
});

function fillCategory(invDate){
    $("#spProcess").show();
    $("#dvCategory").html('');
    $.ajax({
        url: "/api/v1/netsuite/inventoryadjustmentcategory",
        type:"POST",
        data: {"inventorydate": invDate.replace(/-/g,'')}
    }).done(function(res) {
        let finalHTML='';
        if(res && res.data){
            let allCat = res.data;
            allCat.forEach(function (d){
                finalHTML +="<div><label><input class='form-check-input' type='checkbox' value='"+ d.category + "' />&nbsp;"+ d.category +"</label></div>";
            })
        }
        else{
            finalHTML = 'No Record(s) found';
        }
        $("#dvCategory").html(finalHTML);
        $("#spProcess").hide();
    }).fail(function(xhr, status, error) {
      let err = JSON.parse(xhr.responseText);
      if(err.message){
        alert(err.message)
      }
      else{
        alert("Some Error occur while processing, Please try again" );
      }
      $("#spProcess").hide();
    });
}

function selectCategory(selectAll){
    if(selectAll == 1){
        $("#dvCategory input[type='checkbox']").each(function(){
            $(this).prop('checked', true);
        })
    }
    else{
        $("#dvCategory input[type='checkbox']").each(function(){
            $(this).prop('checked', false);
        })
    }
}

function transferCategoryToNetsuite(){
    let selectedCategory = [];
    $("#dvCategory input[type='checkbox']:checked").each(function(){
        selectedCategory.push($(this).val());
    });
    if(selectedCategory.length == 0){
        alert("Please select category to transfer");
        return;
    }
    $("#dvInvAdjLog").html("");
    $("#spProcess").show();
    $.ajax({
        url: "/api/v1/netsuite/inventoryadjustment",
        type:"POST",
        data: {"inventorydate": $("#payloadDate").val().replace(/-/g,''),"categoryList": selectedCategory}
    }).done(function(res) {
        alert("Inventory adjustment transfer completed");
        // let finalHTML='';
        // if(res && res.category_response){
        //     finalHTML +="<div>"+ JSON.stringify(res.category_response) +"</div>";
        // }
        // $("#dvInvAdjLog").html(finalHTML);
        $("#spProcess").hide();
    }).fail(function(xhr, status, error) {
      let err = JSON.parse(xhr.responseText);
      if(err.message){
        alert(err.message)
      }
      else{
        alert("Some Error occur while processing, Please try again" );
      }
      $("#spProcess").hide();
    });
}

function formatDateToYMDHM(isoDateStr) {
  const date = new Date(isoDateStr);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function searchFrankyLog(){
    //logStartDate  logStartTime logEndDate logEndTime
    if($("#logStartDate").val() ==""){
        alert("Please select start date");
        return;
    }
    if($("#logEndDate").val() ==""){
        alert("Please select end date");
        return;
    }
    let startTime = $("#logStartTime").val();
    let endTime = $("#logEndTime").val();
    if(startTime ==""){
        startTime = '12:00';
    }
    if(endTime ==""){
        endTime = '23:59';
    }
    $("#tblFLog tbody").empty();
    $("#spProcess").show();
    $.ajax({
        url: "/api/v1/netsuite/inventoryadjustmentlog",
        type:"POST",
        data: {"start": $("#logStartDate").val() + " "+ startTime ,"end": $("#logEndDate").val() + " "+ endTime}
    }).done(function(res) {
        let finalHTML='';
        if(res && res.data){
            res.data.forEach(function (d,index){
                finalHTML +="<tr>"+ 
                            " <td>"+ (index + 1 ) + "</td>" +  
                            " <td>"+ d.inventory_date +"</td>" + 
                            " <td>"+ d.item_id +"</td>" + 
                            " <td>"+ d.quantity +"</td>" + 
                            " <td>"+ d.message +"</td>" +   
                            " <td>"+ formatDateToYMDHM(d.created_at) +"</td>" +   
                            "</tr>";
            })
        }
        $("#tblFLog tbody").html(finalHTML);
        $("#spProcess").hide();
    }).fail(function(xhr, status, error) {
        alert("Some Error occur while processing, Please try again" );
        $("#spProcess").hide();
    });
}