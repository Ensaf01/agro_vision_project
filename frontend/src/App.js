//frontend/src/App.js
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import FarmerMarketplace from "./pages/FarmerMarketplace";
import DealerMarketplace from "./pages/DealerMarketplace";
import FarmerHomePage from "./pages/FarmerHomePage"; // Farmer-specific homepage
import DealerDetailsPage from "./pages/DealerDetailsPage";

function LandingPage() {
  return (
    <div className="landing">
      {/* Hero Section */}
      <header className="landing-hero">
        <h1> Welcome to AgroVision</h1>
        <p>Empowering Farmers & Dealers with Knowledge and Marketplace</p>
        <a href="/register" className="cta-btn">
          Get Started
        </a>
      </header>

      {/* About Section */}
      <section className="landing-about">
        <h2>About Us</h2>
        <p>
          AgroVision is a platform designed to connect <strong>farmers</strong>{" "}
          and <strong>dealers</strong>. Our mission is to make agriculture more
          profitable, efficient, and sustainable through technology.
        </p>
      </section>

      {/* Services Section */}
      <section className="landing-services">
        <h2>Our Services</h2>
        <div className="service-cards">
          <div className="service-card">
            <img
              src="https://cdn.pixabay.com/photo/2018/06/18/18/45/vegetables-3483075_1280.jpg"
              alt="Marketplace"
            />
            <h3>Buy & Sell Products</h3>
            <p>
              Farmers can sell their crops, seeds, and equipment while dealers
              can reach a wide customer base.
            </p>
          </div>

          <div className="service-card">
            <img
              src="https://cdn.pixabay.com/photo/2018/03/21/16/05/greenhouse-3247181_1280.jpg"
              alt="Crop Policy"
            />
            <h3>Crop Policy & Support</h3>
            <p>
              Stay updated with the latest agricultural policies, subsidies, and
              government programs.
            </p>
          </div>

          <div className="service-card">
            <img
              src="https://cdn.pixabay.com/photo/2025/09/12/02/36/rice-9829225_1280.jpg"
              alt="Knowledge"
            />
            <h3>Knowledge & Guidance</h3>
            <p>
              Access crop guides, weather tips, and expert advice to improve
              productivity and reduce risks.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>
          © {new Date().getFullYear()} AgroVision — Contact: +880 1XXXXXXXXX
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dealer/:dealerId/request/:requestId" element={<DealerDetailsPage />} />

          {/* Protected Routes */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Farmer Homepage */}
          <Route
            path="/farmer-home"
            element={
              <ProtectedRoute>
                <FarmerHomePage />
              </ProtectedRoute>
            }
          />

          {/* Marketplace Routes */}
          <Route
            path="/farmer-marketplace"
            element={
              <ProtectedRoute>
                <FarmerMarketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dealer-marketplace"
            element={
              <ProtectedRoute>
                <DealerMarketplace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
