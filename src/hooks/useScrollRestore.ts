 import { useEffect, useRef, useCallback } from 'react';
 import { useLocation } from 'react-router-dom';
 
 /**
  * Hook to preserve and restore scroll position of an element.
  * @param key Unique key for the scroll position (e.g. tab name or route)
  * @param persist Whether to persist across sessions (localStorage) or just current session (sessionStorage)
  */
 export function useScrollRestore(key: string, persist: boolean = false) {
   const scrollRef = useRef<HTMLDivElement>(null);
   const storage = persist ? localStorage : sessionStorage;
   const storageKey = `scroll-pos-${key}`;
   const location = useLocation();
 
   // Use route + key for better uniqueness
   const fullKey = `${location.pathname}-${key}`;
 
   const saveScroll = useCallback(() => {
     if (scrollRef.current) {
       storage.setItem(storageKey, scrollRef.current.scrollTop.toString());
     }
   }, [storage, storageKey]);
 
   const restoreScroll = useCallback(() => {
     if (scrollRef.current) {
       const saved = storage.getItem(storageKey);
       if (saved) {
         scrollRef.current.scrollTop = parseInt(saved, 10);
       }
     }
   }, [storage, storageKey]);
 
   // Save scroll on unmount or before key change
   useEffect(() => {
     return () => saveScroll();
   }, [saveScroll]);
 
   // Restore scroll on mount or when key changes
   useEffect(() => {
     // Small delay to ensure content is rendered
     const timer = setTimeout(restoreScroll, 50);
     return () => clearTimeout(timer);
   }, [restoreScroll, key]); // Re-run when key changes
 
   // Also save scroll periodically or on scroll events if needed
   const onScroll = useCallback(() => {
     // Debounce save?
     saveScroll();
   }, [saveScroll]);
 
   return { scrollRef, onScroll, restoreScroll };
 }