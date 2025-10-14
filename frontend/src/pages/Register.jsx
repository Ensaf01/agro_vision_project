// frontend/src/pages/register.jsx
import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
// import { useNavigate } from "react-router-dom"; // Removed unused import

export default function Register() {
  const { register } = useContext(AuthContext);
  const [form, setForm] = useState({
    name: "",
    role: "farmer",
    email: "",
    password: "",
    address: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [registeredUser, setRegisteredUser] = useState(null);
  // const navigate = useNavigate(); // Removed unused variable

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // reset previous error
    try {
  const user = await register(form.name, form.email, form.password, form.role, form.address, form.phone);
  setRegisteredUser(user);
    } catch (err) {
      // Show the actual backend error if possible
      setError(err.message || "Registration failed, please try again.");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-form-container">
        {!registeredUser ? (
          <>
            <h2>Create Your Account 🌱</h2>
            <p>Join AgroVision and connect with the community</p>

            {error && <div className="error-box">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={handleChange}
                required
              />

              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="farmer">Farmer</option>
                <option value="dealer">Dealer</option>
              </select>

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

              <label>Address</label>
              <input
                type="text"
                name="address"
                placeholder="Enter your address"
                value={form.address}
                onChange={handleChange}
                required
              />

              <label>Phone Number</label>
              <input
                type="text"
                name="phone"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={handleChange}
                required
              />

              <button type="submit">Register</button>
            </form>

            <p className="switch-link">
              Already have an account? <a href="/login">Login here</a>
            </p>
          </>
        ) : (
          <div className="user-details-box">
            <h2>Registration Successful!</h2>
            <p>Here are your details:</p>
            <ul>
              <li><strong>Name:</strong> {registeredUser.name}</li>
              <li><strong>Email:</strong> {registeredUser.email}</li>
              <li><strong>Role:</strong> {registeredUser.role}</li>
              <li><strong>Address:</strong> {registeredUser.address}</li>
              <li><strong>Phone:</strong> {registeredUser.phone}</li>
            </ul>
            <p className="switch-link">
              <a href="/login">Proceed to Login</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
