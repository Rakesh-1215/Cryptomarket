import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, verifyLoginOtp, resendVerificationOtp } = useAuth();
  const isLoginVerification = location.state?.mode === "login";
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = isLoginVerification
        ? await verifyLoginOtp(email.trim().toLowerCase(), otp.trim())
        : await verifyEmail(email.trim().toLowerCase(), otp.trim());
      if (result.success) {
        alert(
          result.message ||
            (isLoginVerification
              ? "Login verified successfully."
              : "Email verified successfully."),
        );
        navigate(isLoginVerification ? "/" : "/login");
      } else {
        alert(result.error || "Verification failed");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      alert("Enter your email first.");
      return;
    }

    setResending(true);
    try {
      const result = await resendVerificationOtp(email.trim().toLowerCase());
      if (result.success) {
        alert(result.message || "A new OTP has been sent.");
      } else {
        alert(result.error || "Unable to resend OTP");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-1">
          {isLoginVerification ? "Enter Login OTP" : "Verify Email"}
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          {isLoginVerification
            ? "Enter the OTP sent to your email to complete login."
            : "Enter the OTP sent to your email address."}
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.3em]"
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        {!isLoginVerification && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full mt-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        )}

        <p className="text-center text-sm text-gray-400 mt-4">
          Back to <Link to="/login" className="text-blue-400 hover:text-blue-300">login</Link>
        </p>
      </div>
    </div>
  );
}
