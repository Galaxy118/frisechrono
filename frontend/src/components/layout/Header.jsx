/* ═══════════════════════════════════════════════════════════
   components/layout/Header.jsx — Barre de navigation globale
   ═══════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, User, LogOut, ChevronDown, LayoutGrid, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../auth/AuthModal';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [searchQuery, setSearchQuery] = useState('');
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setProfileDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/gallery?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  const openLogin = () => { setAuthMode('login'); setAuthModalOpen(true); setMobileMenuOpen(false); };
  const openRegister = () => { setAuthMode('register'); setAuthModalOpen(true); setMobileMenuOpen(false); };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-gray-800 shrink-0">
            <span className="text-2xl">📅</span>
            <span className="hidden sm:inline">FriseChrono</span>
          </Link>

          {/* Recherche — desktop */}
          <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-md">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher des frises…"
                className="w-full pl-9 pr-4 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition"
              />
            </div>
          </form>

          {/* Spacer mobile */}
          <div className="flex-1 sm:hidden" />

          {/* Bouton recherche mobile */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="sm:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <Search size={18} />
          </button>

          {/* Navigation — desktop */}
          <nav className="hidden sm:flex items-center gap-2">
            <Link
              to="/gallery"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LayoutGrid size={16} />
              <span className="hidden md:inline">Galerie</span>
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/editor"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  <Plus size={16} />
                  <span className="hidden md:inline">Nouvelle frise</span>
                </Link>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdown(!profileDropdown)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition"
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <span className="hidden md:inline text-sm text-gray-700">{user?.username}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>

                  {profileDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg w-48 py-1 z-50">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setProfileDropdown(false)}
                      >
                        <User size={14} /> Mon profil
                      </Link>
                      {user?.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
                          onClick={() => setProfileDropdown(false)}
                        >
                          <Shield size={14} /> Administration
                        </Link>
                      )}
                      <hr className="my-1" />
                      <button
                        onClick={() => { logout(); setProfileDropdown(false); navigate('/'); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <LogOut size={14} /> Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                  Connexion
                </button>
                <button
                  onClick={openRegister}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  S'inscrire
                </button>
              </div>
            )}
          </nav>

          {/* Hamburger mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Barre de recherche mobile dépliable */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-3 pb-3 border-t border-gray-100 bg-white">
            <form onSubmit={handleSearch} className="mt-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher des frises…"
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition"
                />
              </div>
            </form>
          </div>
        )}

        {/* Menu mobile dépliable */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-3 py-3 space-y-1 shadow-lg">
            <Link
              to="/gallery"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutGrid size={16} /> Galerie
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  to="/editor"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Plus size={16} /> Nouvelle frise
                </Link>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User size={16} /> Mon profil
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-yellow-700 hover:bg-yellow-50 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield size={16} /> Administration
                  </Link>
                )}
                <hr className="my-1" />
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg w-full"
                >
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={openLogin}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg w-full"
                >
                  Connexion
                </button>
                <button
                  onClick={openRegister}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium w-full"
                >
                  S'inscrire
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}
