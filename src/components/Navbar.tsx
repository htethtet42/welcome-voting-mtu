import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun, Menu, X, Radio, LogOut, User } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/vote', label: 'Vote', end: false },
  { to: '/results', label: 'Results', end: false },
  { to: '/livestream', label: 'Livestream', end: false, icon: <Radio size={11} style={{ color: '#FF7AAE' }} /> },
  { to: '/admin', label: 'Admin', end: false },
];

export default function Navbar() {
  const { darkMode, toggleDarkMode, election } = useElection();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const baseLink = 'text-sm font-medium transition-colors duration-200 px-3 py-1.5 rounded-full';
  const activeClass = 'text-gold-500 bg-gold-500/10';
  const inactiveClass = darkMode ? 'text-gray-400 hover:text-gold-300' : 'text-gray-600 hover:text-gold-500';

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 border-b transition-colors duration-300 ${
        darkMode ? 'bg-night-950/90 border-gold-500/10' : 'bg-cream-50/90 border-gold-500/20'
      } backdrop-blur-xl`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/MTU2.png"
            alt="MTU Logo"
            style={{ width: 32, height: 32, objectFit: 'contain' ,mixBlendMode: darkMode ? 'screen' : 'multiply'}}
          />
          <span className="font-display font-bold text-lg" style={{ color: '#D4AF37' }}>
            MTU Voting
          </span>
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `${baseLink} ${isActive ? activeClass : inactiveClass}`}
            >
              {l.icon ? (
                <span className="flex items-center gap-1.5">{l.icon}{l.label}</span>
              ) : l.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Election status pill */}
          {election.status === 'open' && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full border" style={{ color: '#00C9A7', borderColor: 'rgba(0,201,167,0.25)', background: 'rgba(0,201,167,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-jade-500 animate-pulse" />
              Voting Open
            </span>
          )}

          {/* User chip */}
          {isAuthenticated ? (
            <div className="hidden sm:flex items-center gap-1.5">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <User size={11} />
                {user?.name.split(' ')[0]} · {user?.studentId}
              </div>
              <button
                onClick={handleLogout}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ color: textMuted(darkMode), background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                title="Sign out"
              >
                <LogOut size={12} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="hidden sm:flex text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              Sign In
            </NavLink>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: darkMode ? '#1E1E30' : '#F0EDE8', color: darkMode ? '#E8C84A' : '#6B7280' }}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Hamburger */}
          <button
            className="md:hidden w-8 h-8 rounded-full flex items-center justify-center"
            onClick={() => setOpen(p => !p)}
          >
            {open
              ? <X size={17} style={{ color: darkMode ? '#D1D5DB' : '#374151' }} />
              : <Menu size={17} style={{ color: darkMode ? '#D1D5DB' : '#374151' }} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-t px-4 py-4 flex flex-col gap-1"
          style={{ background: darkMode ? '#0D0D1A' : '#F8F5EF', borderColor: darkMode ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.2)' }}
        >
          {NAV_LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `${baseLink} py-2.5 ${isActive ? activeClass : inactiveClass}`}
            >
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <button
              onClick={() => { handleLogout(); setOpen(false); }}
              className={`${baseLink} py-2.5 text-left flex items-center gap-2`}
              style={{ color: '#FF7AAE' }}
            >
              <LogOut size={13} /> Sign Out ({user?.name.split(' ')[0]})
            </button>
          ) : (
            <NavLink to="/login" onClick={() => setOpen(false)} className={`${baseLink} py-2.5`} style={{ color: '#D4AF37' }}>
              Sign In
            </NavLink>
          )}
        </div>
      )}
    </nav>
  );
}

function textMuted(dark: boolean) { return dark ? '#9CA3AF' : '#6B7280'; }
