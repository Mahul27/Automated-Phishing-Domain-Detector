import { createContext, useState, useContext, useEffect } from "react";
import personalHistoryData from "../data/personal_history.json";
import liveDomainsCsv from "../data/Live-domains.csv?raw";

const ScanDataContext = createContext();

export function ScanDataProvider({ children }) {
  const [personalRecords, setPersonalRecords] = useState(personalHistoryData);
  const [liveRecords, setLiveRecords] = useState([]);

  useEffect(() => {
    // Parse CSV to create mock live records
    const lines = liveDomainsCsv.split(/\r?\n/).slice(1).filter(Boolean);
    const parsedLiveRecords = lines.map((line, index) => {
      const url = line.trim().replace(/^["']|["']$/g, "");
      const domain = url
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split("?")[0];

      // Simple hash to make the mock data somewhat deterministic but varied
      let hash = 0;
      for (let i = 0; i < domain.length; i++) {
        hash = domain.charCodeAt(i) + ((hash << 5) - hash);
      }

      const riskScore = 50 + (Math.abs(hash) % 50); // Score between 50 and 99
      const isPhishing = riskScore > 75;

      return {
        id: index + 1,
        domain: domain,
        url: url,
        risk_score: riskScore,
        prediction: isPhishing ? "Phishing" : "Suspicious",
        review_status: "Pending",
        tld: "." + domain.split(".").pop(),
        domain_age: isPhishing ? "2 days" : "365 days",
        registration_period: isPhishing ? "1 year" : "5 years",
        domain_length: domain.length,
        hyphens: (domain.match(/-/g) || []).length,
        digits: (domain.match(/\d/g) || []).length,
        shannon_entropy: isPhishing ? "High" : "Low",
        brand_keyword: isPhishing ? "paypal" : "None",
        typosquatting_similarity: isPhishing ? "High" : "Low",
        ssl_cert_age: isPhishing ? "5 days" : "1 year",
      };
    });
    setLiveRecords(parsedLiveRecords);
  }, []);

  const updatePersonalRecord = (updatedRecord) => {
    setPersonalRecords((prevRecords) =>
      prevRecords.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
    );
  };

  const updateLiveRecord = (updatedRecord) => {
    setLiveRecords((prevRecords) =>
      prevRecords.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
    );
  };

  const createFullRecord = (baseRecord) => {
    const domain = baseRecord.domain || "";
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    const riskScore = 50 + (Math.abs(hash) % 50);
    const isPhishing = riskScore > 75;

    return {
      ...baseRecord,
      risk_score: riskScore,
      prediction: isPhishing ? "Phishing" : "Suspicious",
      review_status: "Pending",
      tld: domain.includes(".") ? "." + domain.split(".").pop() : "",
      domain_age: isPhishing ? "2 days" : "365 days",
      registration_period: isPhishing ? "1 year" : "5 years",
      domain_length: domain.length,
      hyphens: (domain.match(/-/g) || []).length,
      digits: (domain.match(/\d/g) || []).length,
      shannon_entropy: isPhishing ? "High" : "Low",
      brand_keyword: isPhishing ? "paypal" : "None",
      typosquatting_similarity: isPhishing ? "High" : "Low",
      ssl_cert_age: isPhishing ? "5 days" : "1 year",
    };
  };

  const addPersonalRecord = (newRecord) => {
    setPersonalRecords((prev) => {
      const newId =
        prev.length > 0 ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      const fullRecord = createFullRecord({ ...newRecord, id: newId });
      return [...prev, fullRecord];
    });
  };

  const addPersonalRecords = (newRecords) => {
    setPersonalRecords((prev) => {
      let currentMaxId =
        prev.length > 0 ? Math.max(...prev.map((r) => r.id)) : 0;
      const recordsWithIds = newRecords.map((record) => {
        currentMaxId++;
        return createFullRecord({ ...record, id: currentMaxId });
      });
      return [...prev, ...recordsWithIds];
    });
  };

  return (
    <ScanDataContext.Provider
      value={{
        personalRecords,
        liveRecords,
        updatePersonalRecord,
        updateLiveRecord,
        addPersonalRecord,
        addPersonalRecords,
      }}
    >
      {children}
    </ScanDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanData() {
  return useContext(ScanDataContext);
}
