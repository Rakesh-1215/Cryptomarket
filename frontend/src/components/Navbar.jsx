import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "./BrandLogo.jsx";

const NAV_ITEMS = [
  { to: "/", label: "Top" },
  { to: "/trending", label: "Trending" },
  { to: "/most-visited", label: "Most Visited" },
  { to: "/new", label: "New" },
  { to: "/gainers", label: "Gainers" },
  { to: "/ai-dashboard", label: "AI Dashboard" },
  { to: "/price-prediction", label: "ML Prediction" },
  { to: "/portfolio-optimization", label: "MPT Portfolio" },
  { to: "/recommendations", label: "Recommendations" },
];

function linkClass({ isActive }) {
  return isActive
    ? "text-white font-semibold"
    : "text-gray-300 hover:text-blue-400";
}

function mobileLinkClass({ isActive }) {
  return `block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
    isActive
      ? "bg-gray-900 text-white font-semibold"
      : "text-gray-300 hover:bg-gray-800 hover:text-blue-400"
  }`;
}

export default function Navbar() {
  const { isAuthenticated, logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close mobile menu when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <NavLink
            to="/"
            className="flex items-center"
            onClick={() => setIsOpen(false)}
          >
            <BrandLogo />
          </NavLink>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex space-x-6 font-medium">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Desktop Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-300">
                  Welcome, {user?.email?.split("@")[0] || "User"}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3 py-1.5 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Register
                </NavLink>
              </>
            )}
          </div>

          {/* Mobile Header Bar: Quick Auth + Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Logout
              </button>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Register
                </NavLink>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close main menu" : "Open main menu"}
            >
              {isOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-gray-800 bg-black/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-1 shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto"
        >
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={mobileLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="pt-4 mt-3 border-t border-gray-800">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-400 px-1">
                  Signed in as{" "}
                  <span className="text-white font-medium">
                    {user?.email?.split("@")[0] || "User"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full text-center px-4 py-2 text-sm font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <NavLink
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="text-center px-4 py-2 text-sm font-medium rounded-md text-gray-200 border border-gray-700 hover:bg-gray-800 transition-colors"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="text-center px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

