import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function PdfRenderer({ uri, onLoadComplete, onError, style }: any) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(uri)
      .then(res => res.blob())
      .then(blob => {
        const newBlob = new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(newBlob) + '#view=Fit&pagemode=none';
        setObjectUrl(url);
        onLoadComplete?.();
      })
      .catch(err => {
        if (!active) return;
        onError?.(err);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri]);

  if (!objectUrl) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <iframe
      src={objectUrl}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}
