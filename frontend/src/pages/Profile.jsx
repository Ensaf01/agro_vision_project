//frontend/src/pages/Profile.jsx
import { useContext, useState } from "react";
import {AuthContext}  from "../context/AuthContext";

export default function Profile() {
  const { user, updateProfile } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || "");
  const [profilePic, setProfilePic] = useState(user?.profile_pic || "");
  const [preview, setPreview] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        name,
        profile_pic: preview || profilePic,
      });
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h2>My Profile</h2>

        <div className="profile-pic-wrapper">
          <img
            src={preview || profilePic || "https://via.placeholder.com/150"}
            alt="Profile"
            className="profile-pic"
          />
          <label className="upload-btn">
            Change Photo
            <input type="file" accept="image/*" onChange={handleFileChange} hidden />
          </label>
        </div>

        <div className="profile-info">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label>Email</label>
          <input type="text" value={user?.email} disabled />

          <label>Role</label>
          <input type="text" value={user?.role} disabled />
        </div>

        <button className="save-btn" onClick={handleSave}>
          Save Changes
        </button>
      </div>
    </div>
  );
}
