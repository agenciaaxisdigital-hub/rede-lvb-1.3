 import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
 import { useLocation } from 'react-router-dom';
 
 /**
  * Hook to preserve and restore scroll position of an element.
  * @param key Unique key for the scroll position (e.g. tab name or route)
  */
 export function useScrollRestore(key: string) {
   const scrollRef = useRef<HTMLDivElement>(null);
   const location = useLocation();
   const storageKey = `scroll-v2-${location.pathname}-${key}`;
 
   const saveScroll = useCallback(() => {
     if (scrollRef.current) {
       sessionStorage.setItem(storageKey, scrollRef.current.scrollTop.toString());
     }
   }, [storageKey]);
 
   const restoreScroll = useCallback(() => {
     if (scrollRef.current) {
       const saved = sessionStorage.getItem(storageKey);
       if (saved) {
         scrollRef.current.scrollTop = parseInt(saved, 10);
       }
     }
   }, [storageKey]);
 
   // Use useLayoutEffect for immediate restoration during render cycle
   useLayoutEffect(() => {
     const doRestore = () => {
       restoreScroll();
       // Also try a bit later as content might be loading
       setTimeout(restoreScroll, 50);
       setTimeout(restoreScroll, 150);
     };
 
     doRestore();
     
     // Listen for manual trigger
     window.addEventListener('restore-scroll', doRestore);
     return () => window.removeEventListener('restore-scroll', doRestore);
   }, [storageKey]);
 
   const onScroll = useCallback(() => {
     saveScroll();
   }, [saveScroll]);
 
   return { scrollRef, onScroll };
 }