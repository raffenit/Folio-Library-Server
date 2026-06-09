import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function PdfRenderer({ uri, onLoadComplete, onError, style }: any) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Give the iframe a moment to start loading before we call onLoadComplete
    const timer = setTimeout(() => {
      setLoaded(true);
      onLoadComplete?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [uri]);

  return (
    <View style={[style, { position: 'relative' }]}>
      {!loaded && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
      <iframe
        src={uri}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onError={(err) => onError?.(err)}
      />
    </View>
  );
}
