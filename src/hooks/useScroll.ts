import { RefObject, useEffect } from 'react';

export function useScroll(element: RefObject<null | HTMLElement>, handleScroll: (e: Event) => void) {
    if (element == null) return;

    useEffect(() => {
        const currentElement = element.current as HTMLElement;
        if (currentElement) {
            currentElement.addEventListener('scroll', handleScroll);
        }
        return () => {
            currentElement?.removeEventListener('scroll', handleScroll);
        };
    }, [element]);
}
