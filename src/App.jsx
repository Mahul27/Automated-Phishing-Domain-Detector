import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ManualScan from './components/ManualScan';
import ScanHistory from './components/ScanHistory';
import ScanResult from './components/ScanResult';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scan" element={<ManualScan />} />
        <Route path="/history" element={<ScanHistory />} />
        <Route path="/result" element={<ScanResult />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
