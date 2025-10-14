// frontend/src/pages/FarmerMarketplace.jsx
import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function FarmerMarketplace() {
  const { user } = useContext(AuthContext);
  const [myCrops, setMyCrops] = useState([]);
  const [marketplaceForm, setMarketplaceForm] = useState({});
  const [directCrop, setDirectCrop] = useState({});
  const [otherCrops, setOtherCrops] = useState([]);

  // Fetch all crops in marketplace for this farmer
  const fetchMyMarketplaceCrops = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/marketplace/my-crops", { credentials: "include" });
      const data = await res.json();
      const mapped = data.map(c => ({
        ...c,
        name: c.crop_name,
        minQuantity: c.min_quantity
      }));
      setMyCrops(mapped);
    } catch (err) {
      console.error("Error fetching marketplace crops", err);
    }
  };

  // Fetch all crops in marketplace for other farmers
  const fetchOtherCrops = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/marketplace/crops", { credentials: "include" });
      const data = await res.json();
      setOtherCrops(data.filter(c => c.farmer_id !== user.id));
    } catch (err) {
      console.error("Error fetching other crops", err);
    }
  };

  useEffect(() => {
    if (user) fetchMyMarketplaceCrops();
    fetchOtherCrops();
  }, [user]);

  // Add existing crop to marketplace
  const handleAddToMarketplace = async (crop) => {
    const formData = marketplaceForm[crop.id];
    if (!formData?.price || !formData?.quantity) return alert("Enter price and quantity");

    try {
      const res = await fetch(`http://localhost:5000/api/marketplace/harvest/${crop.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity)
        })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message);
      alert("Crop added to marketplace!");
      setMarketplaceForm({ ...marketplaceForm, [crop.id]: { price: "", quantity: "" } });
      fetchMyMarketplaceCrops();
    } catch (err) {
      console.error(err);
      alert("Error adding crop to marketplace");
    }
  };

  // Directly add crop/food to marketplace
  const handleAddDirect = async () => {
    if (!directCrop.name || !directCrop.quantity || !directCrop.unit || !directCrop.price) {
      return alert("Fill all required fields (name, quantity, unit, price)");
    }

    try {
      const res = await fetch("http://localhost:5000/api/marketplace/add-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: directCrop.name,
          quantity: parseFloat(directCrop.quantity),
          unit: directCrop.unit,
          price: parseFloat(directCrop.price),
          crop_pic: directCrop.crop_pic || "",
          discount: directCrop.discount ? parseFloat(directCrop.discount) : null,
          minQuantity: directCrop.minQuantity ? parseFloat(directCrop.minQuantity) : null
        })
      });

      const data = await res.json();
      if (!res.ok) return alert(data.message);
      alert("Crop added directly to marketplace!");
      setDirectCrop({ name: "", quantity: "", unit: "", price: "", crop_pic: "", discount: "", minQuantity: "" });
      fetchMyMarketplaceCrops();
    } catch (err) {
      console.error(err);
      alert("Error adding crop directly");
    }
  };

  // Delete crop from marketplace
const handleDelete = async (cropId) => {
  if (!window.confirm("Are you sure you want to remove this crop from the marketplace?")) return;

  try {
    const res = await fetch(`http://localhost:5000/api/marketplace/${cropId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      alert("Crop removed from marketplace!");
      fetchMyMarketplaceCrops(); // refresh list after deletion
    } else {
      const data = await res.json();
      alert("Error: " + (data.message || "Failed to delete crop"));
    }
  } catch (err) {
    console.error("Error deleting crop:", err);
    alert("Error removing crop from marketplace");
  }
};

return (
  <div className="farmer-marketplace">
    <div className="container">

      {/* My Marketplace Crops */}
      <h2 className="section-title">My Marketplace Crops</h2>
      {myCrops.length === 0 && <p>No crops in marketplace yet.</p>}
      <div className="crops-grid">
        {myCrops.map((crop) => (
          <div key={crop.id} className="crop-card">
            <h3>{crop.name}</h3>
            <p>Quantity: {crop.quantity} {crop.unit}</p>
            <p>Price: {crop.price} Tk</p>
            {crop.discount && crop.minQuantity && (
              <p className="discount-text">
                {crop.discount}% discount if buy {crop.minQuantity} {crop.unit} or more
              </p>
            )}
            <button
              onClick={() => handleDelete(crop.id)}
              className="btn btn-delete"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
        {/* Direct Add Crop */}
        <h2 className="section-title">Add Existing Crop/Food Directly</h2>
        <div className="direct-add-grid">
          <div className="crop-card direct-add-card">
            <input type="text" placeholder="Crop/Food Name" value={directCrop.name || ""} onChange={e => setDirectCrop({ ...directCrop, name: e.target.value })} />
            <input type="number" placeholder="Quantity" className="half" value={directCrop.quantity || ""} onChange={e => setDirectCrop({ ...directCrop, quantity: e.target.value })} />
            <input type="text" placeholder="Unit" className="half" value={directCrop.unit || ""} onChange={e => setDirectCrop({ ...directCrop, unit: e.target.value })} />
            <input type="number" placeholder="Price" className="half" value={directCrop.price || ""} onChange={e => setDirectCrop({ ...directCrop, price: e.target.value })} />
            <button className="btn btn-add" onClick={handleAddDirect}>Add Directly</button>
          </div>
        </div>

        {/* Other Farmers’ Crops */}
        <h2 className="section-title">Other Farmers’ Crops</h2>
        {otherCrops.length === 0 && <p>No other crops available.</p>}
        <div className="crops-grid">
          {otherCrops.map(crop => (
            <div key={crop.id} className="crop-card">
              <h3>{crop.crop_name}</h3>
              <p>Quantity: {crop.quantity} {crop.unit || ""}</p>
              <p>Price: {crop.price} Tk</p>
              {crop.highest_bid && <p className="highest-bid">Highest Bid: {crop.highest_bid} Tk</p>}
              <p>Farmer: {crop.farmer_name}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
