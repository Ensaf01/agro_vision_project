//frontend/src/pages/FarmerCropPage.jsx
import React, { useEffect, useState, useContext } from "react";
import jsPDF from "jspdf";
import { AuthContext } from "../context/AuthContext";

export default function FarmerCropPage() {
  // Weather search state
  const [searchArea, setSearchArea] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // Weather API key 
  const WEATHER_API_KEY = "93869cd59972015bacc2b11a2c2b74c7";

  const handleWeatherSearch = async (e) => {
    e.preventDefault();
    setWeather(null);
    setWeatherError("");
    setWeatherLoading(true);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(searchArea)},bd&appid=${WEATHER_API_KEY}&units=metric`
      );
      if (!res.ok) {
        setWeatherError("Area not found or API error.");
        setWeatherLoading(false);
        return;
      }
      const data = await res.json();
      setWeather(data);
    } catch (err) {
      setWeatherError("Failed to fetch weather data.");
    } finally {
      setWeatherLoading(false);
    }
  };
  const { user } = useContext(AuthContext);
  const [crops, setCrops] = useState([]);
  const [requestsMap, setRequestsMap] = useState({}); // cropId -> requests
  const [selectedRequests, setSelectedRequests] = useState({}); // cropId -> dropdown open
  const [dealPopup, setDealPopup] = useState(null); // {request, crop}
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    land_size: "",
    cultivate_date: "",
    harvest_date: "",
    total_cost: "",
    crop_pic: ""
  });
  const [picPreview, setPicPreview] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // harvest modal state
  const [harvestCrop, setHarvestCrop] = useState(null);
  const [harvestForm, setHarvestForm] = useState({
    quantity: "",
    price: "",
    unit: "",
  });
  const [harvestError, setHarvestError] = useState("");
  const [harvestSuccess, setHarvestSuccess] = useState("");

  const fetchCrops = React.useCallback(async () => {
  if (!user) return;
  try {
    const res = await fetch(`http://localhost:5000/api/crops/farmer/${user.id}`, {
      credentials: "include",
    });
    const data = await res.json();

    // Filter out harvested crops (if your backend has `harvested` column)
    const activeCrops = data.filter(crop => !crop.harvested || crop.harvested === 0);

    setCrops(activeCrops);

    // Fetch requests for each crop
    for (const crop of activeCrops) {
      const reqRes = await fetch(`http://localhost:5000/api/marketplace/${crop.id}/requests`, { credentials: "include" });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequestsMap(prev => ({ ...prev, [crop.id]: reqData }));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}, [user]);


  useEffect(() => {
    fetchCrops();
  }, [user, fetchCrops]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(f => ({ ...f, crop_pic: reader.result }));
        setPicPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCrop = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");
    if (!user) {
      setFormError("User not logged in");
      return;
    }
    // Validation
    if (!form.name || !form.land_size || !form.cultivate_date || !form.harvest_date || !form.total_cost) {
      setFormError("All fields are required.");
      return;
    }
    if (isNaN(form.land_size) || Number(form.land_size) <= 0) {
      setFormError("Land size must be a positive number.");
      return;
    }
    if (isNaN(form.total_cost) || Number(form.total_cost) < 0) {
      setFormError("Total cost must be a non-negative number.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/crops/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, farmer_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add crop");
      setForm({
        name: "",
        land_size: "",
        cultivate_date: "",
        harvest_date: "",
        total_cost: "",
        crop_pic: ""
      });
      setPicPreview("");
      setSuccessMsg("Crop added successfully!");
      fetchCrops();
    } catch (err) {
      setFormError("Error adding crop: " + err.message);
    }
  };
  const handleDeleteCrop = async (cropId) => {
    if (!window.confirm("Are you sure you want to delete this crop? This action cannot be undone.")) return;
    try {
      // Try /api/crops/:cropId first
      let res = await fetch(`http://localhost:5000/api/crops/${cropId}`, {
        method: "DELETE",
        credentials: "include"
      });
      // If 404, try /api/crops/delete/:cropId
      if (res.status === 404) {
        res = await fetch(`http://localhost:5000/api/crops/delete/${cropId}`, {
          method: "DELETE",
          credentials: "include"
        });
      }
      if (!res.ok) {
        const data = await res.json();
        alert("Error deleting crop: " + (data.message || "Unknown error"));
        return;
      }
      fetchCrops();
      alert("Crop deleted!");
    } catch (err) {
      alert("Error deleting crop: " + err.message);
    }
  };

  const handleUpdateCrop = async (cropId, updatedFields) => {
    if (!updatedFields.total_cost || isNaN(updatedFields.total_cost) || Number(updatedFields.total_cost) < 0) {
      alert("Total cost must be a non-negative number.");
      return;
    }
    if (!window.confirm("Are you sure you want to update the cost?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/crops/${cropId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatedFields),
      });
      if (!res.ok) {
        const data = await res.json();
        alert("Error updating crop: " + (data.message || "Unknown error"));
        return;
      }
      fetchCrops();
      alert("Crop cost updated!");
    } catch (err) {
      alert("Error updating crop: " + err.message);
    }
  };

  const handleHarvestSubmit = async (e) => {
    e.preventDefault();
    setHarvestError("");
    setHarvestSuccess("");
    if (!harvestCrop) return;
    // Validation
    if (!harvestForm.quantity || isNaN(harvestForm.quantity) || Number(harvestForm.quantity) <= 0) {
      setHarvestError("Quantity must be a positive number.");
      return;
    }
    if (!harvestForm.price || isNaN(harvestForm.price) || Number(harvestForm.price) < 0) {
      setHarvestError("Price must be a non-negative number.");
      return;
    }
    try {
      const res =await fetch(`http://localhost:5000/api/marketplace/harvest/${harvestCrop.id}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    quantity: harvestForm.quantity,
    unit: harvestForm.unit,
    price: harvestForm.price,
    discount: harvestForm.discount || null,
    minQuantity: harvestForm.minQuantity || null
  }),
});

      if (!res.ok) {
        const data = await res.json();
        setHarvestError("Error adding to marketplace: " + (data.message || "Unknown error"));
        return;
      }
      setHarvestSuccess("Crop added to marketplace!");
      setHarvestForm({ quantity: "", price: "" });
      fetchCrops();
      // Auto-close modal after short delay
      setTimeout(() => {
        setHarvestCrop(null);
        setHarvestSuccess("");
      }, 1200);
    } catch (err) {
      setHarvestError("Error adding to marketplace: " + err.message);
    }
  };

  if (loading) return <p>Loading crops...</p>;

  return (
    <div className="farmer-crop-bg" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f7fa 0%, #f9fbe7 100%)',
      padding: '32px 0'
    }}>
      {/* Area Weather Search Bar */}
      <div style={{
        maxWidth: 500,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 8px #b2dfdb',
        padding: 24,
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <form onSubmit={handleWeatherSearch} style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="Search area/city for weather..."
            value={searchArea}
            onChange={e => setSearchArea(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #b2dfdb', fontSize: 16 }}
            required
          />
          <button type="submit" style={{ background: '#26c6da', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer' }}>
            Search
          </button>
        </form>
        {weatherLoading && <div style={{ marginTop: 12 }}>Loading weather...</div>}
        {weatherError && (
          <div style={{ marginTop: 12, color: 'red' }}>
            {weatherError}
            <br />
            <span style={{ fontSize: 13, color: '#888' }}>
              Please enter a valid Bangladesh city or district name (e.g., Dhaka, Chittagong, Rajshahi).
            </span>
          </div>
        )}
        {weather && (
          <div style={{ marginTop: 18, textAlign: 'left' }}>
            <h3 style={{ marginBottom: 8 }}>Weather in {weather.name}, {weather.sys?.country}</h3>
            <p><strong>Temperature:</strong> {weather.main?.temp}°C</p>
            <p><strong>Condition:</strong> {weather.weather?.[0]?.description}</p>
            <p><strong>Humidity:</strong> {weather.main?.humidity}%</p>
            <p><strong>Wind:</strong> {weather.wind?.speed} m/s</p>
            <p><strong>Clouds:</strong> {weather.clouds?.all}%</p>
            <p><strong>Pressure:</strong> {weather.main?.pressure} hPa</p>
          </div>
        )}
      </div>
      {/* Add Crop Form */}
      <form onSubmit={handleAddCrop} className="mb-6 p-4 border rounded">
        <h3 className="font-bold mb-2">Add New Crop</h3>
        {formError && <div className="error-box">{formError}</div>}
        {successMsg && <div className="toast-success">{successMsg}</div>}
  <input name="name" placeholder="Crop Name" value={form.name} onChange={handleChange} required />
  <input type="file" accept="image/*" onChange={handlePicChange} />
  {picPreview && <img src={picPreview} alt="Preview" style={{maxWidth:100, marginBottom:8}} />}
        <input name="land_size" placeholder="Land Size (acre)" value={form.land_size} onChange={handleChange} required />
        <input name="cultivate_date" type="date" value={form.cultivate_date} onChange={handleChange} required />
        <input name="harvest_date" type="date" value={form.harvest_date} onChange={handleChange} required />
        <input name="total_cost" type="number" placeholder="Total Cost" value={form.total_cost} onChange={handleChange} required />
        <button type="submit" className="mt-2 bg-green-500 text-white px-3 py-1 rounded">Add Crop</button>
      </form>

      {/* Crop List */}
      <h3 className="font-bold mb-2">My Crops</h3>
      {crops.length === 0 ? (
        <p>No crops added yet.</p>
      ) : (
        <div className="grid gap-4">
          {crops.map((crop) => {
            // Calculate growth percentage
            let percent = 0;
            if (crop.cultivate_date && crop.harvest_date) {
              const start = new Date(crop.cultivate_date);
              const end = new Date(crop.harvest_date);
              const now = new Date();
              if (end > start) {
                const totalDays = (end - start) / (1000 * 60 * 60 * 24);
                const elapsedDays = (now - start) / (1000 * 60 * 60 * 24);
                percent = Math.min(100, Math.max(0, ((elapsedDays / totalDays) * 100).toFixed(2)));
              }
            }
            const canHarvest = percent >= 80;
            const requests = requestsMap[crop.id] || [];
            return (
              <div key={crop.id} className="p-3 border rounded" style={{ position: 'relative', minHeight: 220 }}>
                {/* Top left: number of dealer requests */}
                <div style={{ position: 'absolute', top: 10, left: 10, background: '#26c6da', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                  {requests.length}
                </div>
                {/* Crop image */}
                {crop.crop_pic && <img src={crop.crop_pic} alt="Crop" style={{maxWidth:100, marginBottom:8, borderRadius:8}} />}
                <p><strong>{crop.name}</strong></p>
                <p>Land: {crop.land_size} acre</p>
                <p>Cultivate: {crop.cultivate_date} | Harvest: {crop.harvest_date}</p>
                <p>Total Cost: {crop.total_cost} Tk</p>
                <p>Status: <span className="highlight">{percent}% grown</span> {percent < 80 && "(Cannot harvest before 80%)"}</p>
                {/* Dealer requests dropdown */}
                {requests.length > 0 && (
                  <div style={{ margin: '10px 0' }}>
                    <button style={{ background: '#26a69a', color: '#fff', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }} onClick={() => setSelectedRequests(s => ({ ...s, [crop.id]: !s[crop.id] }))}>
                      Dealer Requests ▼
                    </button>
                    {selectedRequests[crop.id] && (
                      <div style={{ background: '#f0f0f0', borderRadius: 8, marginTop: 8, padding: 8 }}>
                        {requests.map(req => (
                          <div key={req.id} style={{ marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 6 }}>
                            <div><strong>Dealer:</strong> {req.dealer_name || req.dealer_id}</div>
                            <div><strong>Price:</strong> {req.bid_price} Tk</div>
                            <div><strong>Quantity:</strong> {req.requested_quantity} {req.unit}</div>
                            <div><strong>Phone:</strong> {req.dealer_phone}</div>
                            <div><strong>Address:</strong> {req.dealer_address}</div>
                            <button style={{ background: '#43a047', color: '#fff', borderRadius: 6, padding: '4px 10px', marginTop: 6 }} onClick={() => setDealPopup({ request: req, crop })}>Accept</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* ...existing buttons... */}
               <button
  onClick={() => {
    const newCostStr = prompt("Update total cost:", crop.total_cost);
    if (newCostStr !== null && newCostStr !== "") {
      const newCost = parseFloat(newCostStr);
      if (isNaN(newCost) || newCost < 0) {
        alert("Total cost must be a non-negative number.");
        return;
      }
      handleUpdateCrop(crop.id, { total_cost: newCost });
    }
  }}
  className="mr-2 bg-yellow-500 text-white px-2 py-1 rounded"
>
  Update Cost
</button>

                <button
                  onClick={() => handleDeleteCrop(crop.id)}
                  className="mr-2 bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => setHarvestCrop(crop)}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                  disabled={!canHarvest}
                  title={!canHarvest ? "You can only harvest when crop is at least 80% grown." : "Harvest"}
                >
                  Harvest
                </button>
                
              </div>
            );
          })}
  {/* Deal Done */}
  {dealPopup && (
    <div className="popup">
      <h3>🎉 Congratulations! Deal Done</h3>
      <p>Dealer <strong>{dealPopup.request.dealer_name || dealPopup.request.dealer_id}</strong> will buy <strong>{dealPopup.request.requested_quantity} {dealPopup.request.unit}</strong> of <strong>{dealPopup.crop.name}</strong> at <strong>{dealPopup.request.bid_price} Tk</strong>.</p>
      <button onClick={() => {
        // Generate PDF here for the deal
          // Generate PDF here for the deal
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('AgroVision Deal Confirmation', 20, 20);
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
        doc.text(`Farmer: ${user.name} (ID: ${user.id})`, 20, 40);
        doc.text(`Dealer: ${dealPopup.request.dealer_name || dealPopup.request.dealer_id}`, 20, 50);
        doc.text(`Dealer Phone: ${dealPopup.request.dealer_phone}`, 20, 60);
        doc.text(`Dealer Address: ${dealPopup.request.dealer_address}`, 20, 70);
        doc.text(`Crop: ${dealPopup.crop.name}`, 20, 80);
        doc.text(`Quantity: ${dealPopup.request.requested_quantity} ${dealPopup.request.unit}`, 20, 90);
        doc.text(`Price: ${dealPopup.request.bid_price} Tk`, 20, 100);
        doc.text(`Land Size: ${dealPopup.crop.land_size} acre`, 20, 110);
        doc.text(`Cultivate Date: ${dealPopup.crop.cultivate_date}`, 20, 120);
        doc.text(`Harvest Date: ${dealPopup.crop.harvest_date}`, 20, 130);
        doc.text(`Total Cost: ${dealPopup.crop.total_cost} Tk`, 20, 140);
        doc.save(`deal_request_${dealPopup.request.id}_${Date.now()}.pdf`);
        setDealPopup(null);
      }}>Download PDF</button>
      <button style={{ marginLeft: 10 }} onClick={() => setDealPopup(null)}>Close</button>
    </div>
  )}
        </div>
      )}

      {/* Harvest Modal */}
      {harvestCrop && (
        <div className="modal-overlay">
          <div className="modal-box">
            <button className="close-btn" onClick={() => setHarvestCrop(null)} style={{float:'right'}}>×</button>
            <h3>Harvest {harvestCrop.name}</h3>
            {harvestError && <div className="error-box">{harvestError}</div>}
            {harvestSuccess && <div className="toast-success">{harvestSuccess}</div>}
            <form onSubmit={handleHarvestSubmit}>
          <input
    type="number"
    placeholder="Quantity"
    value={harvestForm.quantity}
    onChange={(e) => setHarvestForm({ ...harvestForm, quantity: e.target.value })}
    required
          />

  <select
  value={harvestForm.unit}
  onChange={(e) => setHarvestForm({ ...harvestForm, unit: e.target.value })}
  required
>
  <option value="">Select Unit</option>
  <option value="kg">kg</option>
  <option value="unit">unit</option>
</select>


  <input
    type="number"
    placeholder="Price per unit/kg"
    value={harvestForm.price}
    onChange={(e) => setHarvestForm({ ...harvestForm, price: e.target.value })}
    required
  />

              <div className="modal-actions">
                <button type="button" onClick={() => setHarvestCrop(null)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="confirm-btn">
                  Add to Marketplace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
