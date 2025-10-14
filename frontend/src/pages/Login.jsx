//frontend/src/pages/login.jsx
import { useState, useContext } from "react";
import {AuthContext} from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(form.email, form.password);
      // Navigate based on backend role
      if (user.role === "farmer") {
        navigate("/farmer-home");
      } else if (user.role === "dealer") {
        navigate("/home");
      }
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-form-container">
        <h2>Welcome Back To Agro-vision</h2>
        <p>Login to continue your AgroVision journey</p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {/* Role selection removed, role comes from backend */}

          <button type="submit">Login</button>
        </form>

        <p className="switch-link">
          Don't have an account? <a href="/register">Register here</a>
        </p>
      </div>
    </div>
  );
}

