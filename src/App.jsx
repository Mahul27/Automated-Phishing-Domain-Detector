import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import LiveDashboard from './pages/LiveDashboard';
import AnalystWorkspace from './pages/AnalystWorkspace';
import LiveReviewQueue from './pages/LiveReviewQueue';
import ScanResult from './pages/ScanResult';
import Layout from './components/Layout';
import { ScanDataProvider } from './context/ScanDataContext';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Authenticated Routes with Sidebar/Layout */}
        <Route element={<ScanDataProvider><Layout /></ScanDataProvider>}>
          <Route path="/dashboard" element={<LiveDashboard />} />
          <Route path="/workspace" element={<AnalystWorkspace />} />
          <Route path="/queue" element={<LiveReviewQueue />} />
          <Route path="/review/:id" element={<ScanResult />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
