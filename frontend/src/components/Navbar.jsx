//frontend/src/components/Navbar.jsx
import { useContext, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import  {AuthContext}  from "../context/AuthContext";
import { io } from "socket.io-client";

// Optional helper to display "time ago"
const timeAgo = (date) => {
  const now = new Date();
  const diff = (now - new Date(date)) / 1000; // seconds
  if (diff < 60) return `${Math.floor(diff)} sec ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  // Removed unused socket state

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };


  useEffect(() => {
    if (!user) return;

    // Inline fetchNotifications to avoid missing dependency warning
    (async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/requests/notifications/${user.id}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    })();

    const newSocket = io("http://localhost:5000", { withCredentials: true });
    newSocket.emit("joinRoom", `farmer_${user.id}`);
    newSocket.on("newRequest", (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    });
    return () => newSocket.disconnect();
  }, [user]);


  // Click a notification: navigate and mark as read
  const handleClickNotification = async (notif) => {
    // Navigate to dealer request details
    nav(`/dealer/${notif.dealer_id}/request/${notif.request_id}`);

    // If unread, mark as read in backend
    if (!notif.read_flag) {
      try {
        await fetch(
          `http://localhost:5000/api/requests/notifications/read/${notif.id}`,
          { method: "POST", credentials: "include" }
        );
        // Update local UI immediately
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, read_flag: 1 } : n
          )
        );
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
    // Close the dropdown
    setOpen(false);
  };

  // Refetch notifications when read count changes
  const readCount = notifications.filter(n => n.read_flag).length;
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/requests/notifications/${user.id}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        // silent
      }
    })();
  }, [readCount, user]);


  const unreadCount = notifications.filter((n) => !n.read_flag).length;

  return (
    <nav className="navbar flex justify-between items-center p-4 bg-white shadow">
      <div className="nav-left">
        <Link to="/" className="font-bold text-xl tracking-wide">AgroVision</Link>
      </div>

      <div className="nav-right flex items-center gap-4">
        {user ? (
          <>
            <NavLink to="/home">Home</NavLink>
            <NavLink to="/profile">Profile</NavLink>

            {/* Notification Bell */}
            <div className="notification-wrapper relative">
              <button
                className="notification-bell relative text-2xl"
                onClick={() => setOpen(!open)}
                aria-label="Notifications"
                style={{ outline: 'none', transition: 'transform 0.2s' }}
              >
                <span style={{ display: 'inline-block', animation: unreadCount > 0 ? 'bellShake 0.7s infinite' : 'none' }}>
                  🔔
                </span>
                {unreadCount > 0 && (
                  <span className="badge" style={{ position: 'absolute', top: '-6px', right: '-8px', background: 'red', color: 'white', borderRadius: '50%', fontSize: '0.7rem', padding: '2px 6px', fontWeight: 'bold', boxShadow: '0 0 6px #c00' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {open && (
                <div className="notification-dropdown animate-dropdownFade">
                  <h4 className="p-2 font-bold border-b">Notifications</h4>
                  {notifications.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No notifications</p>
                  ) : (
                    <>
                      <div className="mb-2">
                        <NavLink to="/farmer/requests" className="text-blue-600 hover:underline font-semibold">Review Requests</NavLink>
                      </div>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleClickNotification(n)}
                          className={`notification-item cursor-pointer rounded transition-all duration-150 ${
                            n.read_flag
                              ? "bg-white text-black"
                              : "bg-blue-50 text-blue-800 font-semibold shadow-sm"
                          }`}
                          style={{ marginBottom: '2px' }}
                        >
                          <span className="block">
                            <strong>{n.crop_name}</strong> request: {n.requested_quantity} {n.unit} at <span style={{ color: '#007bff', fontWeight: 'bold' }}>{n.bid_price} Tk</span>
                          </span>
                          <span className="text-xs text-gray-500 flex justify-between items-center">
                            {timeAgo(n.created_at)}
                            {!n.read_flag && (
                              <span className="ml-2 text-red-500">●</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="ml-2 px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition">Logout</button>
            <img
              src={user.profile_pic || "/default-avatar.png"}
              alt="profile"
              className="nav-avatar"
            />
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}

// Bell shake animation
const bellShake = `@keyframes bellShake {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(-15deg); }
  40% { transform: rotate(10deg); }
  60% { transform: rotate(-10deg); }
  80% { transform: rotate(5deg); }
  100% { transform: rotate(0deg); }
}`;
if (typeof document !== "undefined" && !document.getElementById("bellShakeStyle")) {
  const style = document.createElement("style");
  style.id = "bellShakeStyle";
  style.innerHTML = bellShake;
  document.head.appendChild(style);
}
