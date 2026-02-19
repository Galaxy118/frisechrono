import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Profile from './pages/Profile';
import Gallery from './pages/Gallery';
import SharedFrise from './pages/SharedFrise';
import ViewFrise from './pages/ViewFrise';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Routes avec le Layout (header) */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          {/* Éditeur pleine page (sans header standard) */}
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/:id" element={<Editor />} />

          {/* Vue lecture seule d'une frise publique */}
          <Route path="/view/:id" element={<ViewFrise />} />

          {/* Frise partagée */}
          <Route path="/share/:token" element={<SharedFrise />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
