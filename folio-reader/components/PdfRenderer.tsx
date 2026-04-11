import React from 'react';
import Pdf from 'react-native-pdf';

export default function PdfRenderer({ uri, onLoadComplete, onPageChanged, onError, style }: any) {
  return (
    <Pdf
      source={{ uri }}
      trustAllCerts={false}
      onLoadComplete={onLoadComplete}
      onPageChanged={onPageChanged}
      onError={onError}
      style={style}
    />
  );
}
