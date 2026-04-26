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
     // Try multiple times to account for dynamic content loading
     restoreScroll();
     const timer1 = setTimeout(restoreScroll, 50);
     const timer2 = setTimeout(restoreScroll, 200);
     const timer3 = setTimeout(restoreScroll, 500);
     
     return () => {
       clearTimeout(timer1);
       clearTimeout(timer2);
       clearTimeout(timer3);
     };
   }, [storageKey]);
 
   const onScroll = useCallback(() => {
     saveScroll();
   }, [saveScroll]);
 
   return { scrollRef, onScroll };
 }