//Frontend/src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check current login status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:5000/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
      
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Login failed');
    const data = await res.json();
    setUser(data);
    return data;
  };


  const register = async (name, email, password, role, address, phone) => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, address, phone }),
      credentials: 'include',
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Register failed');
    }

    const data = await res.json();
    setUser(data);
    return data;
  };


  const logout = async () => {
    await fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const updateProfile = async (updatedData) => {
  const res = await fetch("http://localhost:5000/api/auth/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedData),
    credentials: "include", // ✅ send cookies
  });

  if (!res.ok) {
    const errorText = await res.text(); // show backend error
    throw new Error(errorText || "Update failed");
  }

  const data = await res.json();
  setUser(data);
  return data;
};



  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
