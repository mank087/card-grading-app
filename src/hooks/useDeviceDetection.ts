'use client';

import { useState, useEffect } from 'react';
import { isMobile, isTablet, isIOS, isAndroid } from 'react-device-detect';

export const useDeviceDetection = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return default values during SSR
  if (!mounted) {
    return {
      isMobileDevice: false,
      isTabletDevice: false,
      isIOSDevice: false,
      isAndroidDevice: false,
      showCameraOption: false,
      mounted: false
    };
  }

  return {
    isMobileDevice: isMobile,
    isTabletDevice: isTablet,
    isIOSDevice: isIOS,
    isAndroidDevice: isAndroid,
    showCameraOption: isMobile || isTablet,
    mounted: true
  };
};
