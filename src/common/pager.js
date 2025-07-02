import React, { useState, useEffect, useCallback } from 'react'; 
import classNames from 'classnames';

const PagerControl = (props) =>{
    const displayItemPerPage = props.displayItemPerPage||5;
    const displayItemCount = props.displayItemCount||1;
    const [ currentPage, setCurrentPage] = useState(1);
    
    const fillData = async()=>{
        if(props.recordCount){
            setCurrentPage(1);
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onLoadFillData = useCallback(fillData, [props.reset]);
    useEffect(() => {
        //console.log("component mount event");
        onLoadFillData();
        return () => {
            //console.log("component unmount event");
        };
    }, [onLoadFillData]);

    const pageRange = (from, to, step = 1) => {
        let i = from;
        const range = [];
      
        while (i <= to) {
          range.push(i);
          i += step;
        }
      
        return range;
    }
    
    const onPageSelected = (pageIndex)=>{
        setCurrentPage(pageIndex);
        props.changePageEvent(pageIndex);
    }

    const fetchPageNumbers = () => {
        const LEFT_PAGE = '<';
        const RIGHT_PAGE = '>'; 
        let Left_Index = 0;
        let Right_Index = 0;
        
        const totalPages = Math.ceil(displayItemCount / displayItemPerPage); 
        if(totalPages === 1)return;
        const pageNeighbours = 2;
    
        const totalNumbers = (pageNeighbours * 2) + 3;
        const totalBlocks = totalNumbers + 2;
        
        let finalResult = [];
        if (totalPages > totalBlocks) {
          const startPage = Math.max(2, currentPage - pageNeighbours);
          const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);
    
          let pages = pageRange(startPage, endPage);
    
          const hasLeftSpill = startPage > 2;
          const hasRightSpill = (totalPages - endPage) > 1;
          const spillOffset = totalNumbers - (pages.length + 1);
    
          if(hasLeftSpill && !hasRightSpill) {
            let extraPages = pageRange(startPage - spillOffset, startPage - 1);
            Left_Index = startPage - 1;
            pages = [LEFT_PAGE, ...extraPages, ...pages];
          }
          else if (!hasLeftSpill && hasRightSpill) { // handle: (1) {2 3} [4] {5 6} > (10)
            Right_Index = endPage + spillOffset + 1;
            const extraPages = pageRange(endPage + 1, endPage + spillOffset);
            pages = [...pages, ...extraPages, RIGHT_PAGE];
          }
          else  { // handle: (1) < {4 5} [6] {7 8} > (10)
            Left_Index = startPage - 1;
            Right_Index = endPage + 1;
            pages = [LEFT_PAGE, ...pages, RIGHT_PAGE];
          }
    
          finalResult = [1, ...pages, totalPages];
        }
        else{
          finalResult = pageRange(1, totalPages);
        }
    
        return finalResult.map((item,index) => 
          <li className={classNames("page-item",{"active":currentPage === item})} key={index}>
            {item === LEFT_PAGE && <button onClick={()=>onPageSelected(Left_Index)}>{item}</button>}
            {item === RIGHT_PAGE && <button onClick={()=>onPageSelected(Right_Index)}>{item}</button>}
            {item !== LEFT_PAGE && item !== RIGHT_PAGE && <button onClick={()=>onPageSelected(item)}>{item}</button>}
          </li>);
    }

    return (
        <>
            <ul className="pagination justify-content-center fnt16-w500">
                {fetchPageNumbers()}
            </ul>
        </>
    )
}
export default PagerControl