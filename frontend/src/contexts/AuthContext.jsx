import React, { createContext, useContext, useState, useEffect } from "react";
import { startRazorpayCheckout } from "../utils/razorpay.js";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      fetch("/api/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem("token");
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, ...data };
    } else {
      return { success: false, error: data.error };
    }
  };

  const register = async (username, email, password) => {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, ...data };
    } else {
      return { success: false, error: data.error };
    }
  };

  const verifyEmail = async (email, otp) => {
    const response = await fetch("/api/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, message: data.message };
    }

    return { success: false, error: data.error };
  };

  const verifyLoginOtp = async (email, otp) => {
    const response = await fetch("/api/verify-login-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();

    if (response.ok) {
      setToken(data.token);
      localStorage.setItem("token", data.token);
      setUser(data.user || { email });
      return { success: true };
    }

    return { success: false, error: data.error };
  };

  const resendVerificationOtp = async (email) => {
    const response = await fetch("/api/resend-verification-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, message: data.message };
    }

    return { success: false, error: data.error };
  };

  const buyCrypto = async (cryptoType, amount, price) => {
    const response = await fetch("/api/buy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cryptoType, amount, price }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const buyCryptoWithRazorpay = async ({
    cryptoType,
    cryptoName,
    amount,
    price,
    preferredMethod,
  }) => {
    try {
      const result = await startRazorpayCheckout({
        token,
        cryptoType,
        cryptoName,
        amount,
        price,
        customer: user,
        preferredMethod,
      });

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    verifyEmail,
    verifyLoginOtp,
    resendVerificationOtp,
    buyCrypto,
    buyCryptoWithRazorpay,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
