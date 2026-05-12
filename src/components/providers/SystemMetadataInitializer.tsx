'use client';

import { useEffect } from 'react';
import { useSystemMetadataStore } from '@/store/useSystemMetadataStore';

export function SystemMetadataInitializer() {
  const refreshSystemMetadata = useSystemMetadataStore((state) => state.refreshSystemMetadata);

  useEffect(() => {
    void refreshSystemMetadata();
  }, [refreshSystemMetadata]);

  return null;
}
