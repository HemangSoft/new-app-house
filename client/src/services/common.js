

export function splitToNChunks(array, n) {
    let result = [];
    for (let i = n; i > 0; i--) {
        result.push(array.splice(0, Math.ceil(array.length / i)));
    }
    return result;
}


export function numberFormat(value,minDec,maxDeci) {
    let result = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'usd',
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDeci
    }).format(value);

    return result;
}

export function defaultAddToCart() {
    return {id:0,name:'',base_price:null,old_price:null,image:'/images/noimage.png',brand:'',prod_line_desc:''};
}