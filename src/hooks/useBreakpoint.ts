import { useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 800;

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    isDesktop: width >= DESKTOP_BREAKPOINT,
    isMobile: width < DESKTOP_BREAKPOINT,
    width,
  };
}
