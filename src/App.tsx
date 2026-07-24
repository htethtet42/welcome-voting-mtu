import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ElectionProvider } from './context/ElectionContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Vote from './pages/Vote';
import Results from './pages/Results';
import Livestream from './pages/Livestream';
import Admin from './pages/Admin';

export default function App() {
  return (
    <ElectionProvider>
      <AuthProvider>
        <HashRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/vote" element={<Vote />} />
            <Route path="/results" element={<Results />} />
            <Route path="/livestream" element={<Livestream />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ElectionProvider>
  );
}
