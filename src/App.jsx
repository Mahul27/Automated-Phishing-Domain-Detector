import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import ManualScan from './pages/ManualScan';
import ScanHistory from './pages/ScanHistory';
import ScanResult from './pages/ScanResult';
import DataUpload from './pages/DataUpload';
import Layout from './components/Layout';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Authenticated Routes with Sidebar/Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<ManualScan />} />
          <Route path="/upload" element={<DataUpload />} />
          <Route path="/history" element={<ScanHistory />} />
          <Route path="/review/:id" element={<ScanResult />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
