import { createContext, useState, useContext } from 'react';
import demoData from '../data/demo_data.json';

const ScanDataContext = createContext();

export function ScanDataProvider({ children }) {
  const [records, setRecords] = useState(demoData);

  const updateRecord = (updatedRecord) => {
    setRecords((prevRecords) =>
      prevRecords.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
  };

  return (
    <ScanDataContext.Provider value={{ records, updateRecord }}>
      {children}
    </ScanDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanData() {
  return useContext(ScanDataContext);
}
