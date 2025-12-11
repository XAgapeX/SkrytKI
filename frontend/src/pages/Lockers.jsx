import { useState, useEffect, useContext } from "react";
import API from "../api";
import { AuthContext } from "../AuthContext";

export default function Lockers() {
  const { user } = useContext(AuthContext);
  const [lockers, setLockers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [sendGroupId, setSendGroupId] = useState("");
  const [destinationGroupId, setDestinationGroupId] = useState("");
  const [lockerId, setLockerId] = useState("");
  const [pendingPackage, setPendingPackage] = useState(null);


async function checkPendingPackage() {
  try {
    const { data } = await API.get("/user/pending");
    if (data.ok && data.pending) {
      setPendingPackage(data.locker);
    } else {
      setPendingPackage(null);
    }
  } catch (err) {
    console.error("Cannot check pending packages:", err);
  }
}

// ---------------- COURIER DATA ----------------
const [courierStatus, setCourierStatus] = useState({
  pickupReady: [],
  toDeliver: [],
});

async function loadCourierStatus() {
  try {
    const { data } = await API.get("/courier/status");
    if (data.ok) {
      setCourierStatus({
        pickupReady: data.pickupReady || [],
        inTransit: data.inTransit || [],
      });
    }
  } catch (err) {
    console.error("Cannot load courier status:", err);
  }
}

  // ---------------- LOAD LOCKERS & GROUPS ----------------
  async function loadLockers() {
    try {
      const { data } = await API.get("/lockers");
      setLockers(data.lockers || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadGroups() {
    try {
      const { data } = await API.get("/lockerGroups");
      setGroups(data.groups || []);
    } catch (err) {
      console.error("Cannot load locker groups:", err);
    }
  }

useEffect(() => {
  if (!user) return;
  loadGroups();

  if (user.role === "admin" || user.role === "service") {
    loadLockers();
  }

  if (user.role === "courier") {
    loadCourierStatus();
  }

  if (user.role === "user") {
    checkPendingPackage();
  }
}, [user]);

// ---------------- COURIER REFRESH ----------------
async function refreshCourierStatus(groupId) {
  try {
    const { data } = await API.post("/courier/statusByGroup", {
      groupId: Number(groupId),
    });
    if (data.ok) {
      setCourierStatus({
        pickupReady: data.pickupReady || [],
        toDeliver: data.toDeliver || [],
      });
    }
  } catch (err) {
    console.error("Cannot refresh courier status:", err);
  }
}

  // ---------------- GENERIC ACTION ----------------
  async function send(path, body = {}) {
    try {
      await API.post(path, body);
      if (user?.role === "admin" || user?.role === "service") {
        loadLockers();
      }
    } catch (err) {
      alert(
        err?.response?.data?.error || "Something went wrong. Check console."
      );
      console.error(err);
    }
  }

  if (!user) return <p>Login first!</p>;

  return (
    <div>
      <h2>Locker Panel ({user.role})</h2>

      {/* ---------------- USER PANEL ---------------- */}
{user.role === "user" && (
  <>
    <h3>User Panel</h3>

    {/* Komunikat o oczekującej paczce */}
    {pendingPackage ? (
      <div
        style={{
          padding: "8px",
          marginBottom: "10px",
          background: "rgba(100,255,100,0.1)",
          border: "1px solid limegreen",
        }}
      >
        📫 You have a package waiting in <b>{pendingPackage.location}</b>!
        <br />
        Locker #{pendingPackage.id} — {pendingPackage.packageId}
      </div>
    ) : (
      <p style={{ color: "#aaa" }}>No package waiting for pickup.</p>
    )}

    {/* Nadawanie paczki */}
    <h4>Send Package</h4>

    <label>Pickup from locker group:</label>
    <select
      value={sendGroupId}
      onChange={(e) => setSendGroupId(e.target.value)}
    >
      <option value="">-- Select sourcelocker group --</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>

    <label style={{ marginTop: "8px", display: "block" }}>
      Deliver to locker group:
    </label>
    <select
      value={destinationGroupId}
      onChange={(e) => setDestinationGroupId(e.target.value)}
    >
      <option value="">-- Select destination locker group --</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>

    <input
      type="email"
      placeholder="Recipient email"
      id="recipientEmail"
      style={{ marginTop: "10px", padding: "4px" }}
    />

    <div style={{ marginTop: "10px" }}>
      <button
  onClick={async () => {
    const emailInput = document.getElementById("recipientEmail");
    const recipientEmail = emailInput.value.trim();

    if (!sendGroupId) return alert("Select pickup locker group");
    if (!destinationGroupId)
      return alert("Select destination locker group");
    if (!recipientEmail) return alert("Enter recipient email");

    try {
      const res = await API.post("/lockers/send", {
        sendGroupId: Number(sendGroupId),
        destinationGroupId: Number(destinationGroupId),
        recipientEmail,
      });

      if (res.data.ok) {
        alert(`📦 ${res.data.message}`);
      } else {
        alert(`⚠️ ${res.data.error}`);
      }
      checkPendingPackage();
    } catch (err) {
      console.error("Send error:", err.response?.data || err);
      alert(
        "❌ Failed to send package:\n" +
          (err.response?.data?.error || err.message)
      );
    }
  }}
>
  Send Package
</button>

      <button
        onClick={async () => {
          const res = await API.post("/lockers/receive");
          alert(`✅ ${res.data.message}`);
          checkPendingPackage();
        }}
      >
        Receive Package
      </button>
    </div>
  </>
)}

{/* ---------------- COURIER PANEL ---------------- */}
{user.role === "courier" && (
  <div>
    <h3>Courier Panel</h3>

    {/* --- Wybór lokalizacji --- */}
    <label style={{ display: "block", margin: "10px 0 5px" }}>
      Select current locker group:
    </label>
    <select
      value={selectedGroup}
      onChange={async (e) => {
        const gId = e.target.value;
        setSelectedGroup(gId);
        if (!gId) {
          setCourierStatus({ pickupReady: [], toDeliver: [] });
          return;
        }
        await refreshCourierStatus(gId);
      }}
      style={{ marginBottom: "15px", padding: "5px" }}
    >
      <option value="">-- Choose locker group --</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.location || "no address"})
        </option>
      ))}
    </select>

    {/* --- Przycisk odświeżania --- */}
    {selectedGroup && (
      <button
        style={{
          marginLeft: "10px",
          padding: "4px 10px",
          cursor: "pointer",
        }}
        onClick={() => refreshCourierStatus(selectedGroup)}
      >
        🔁 Refresh Status
      </button>
    )}

    {/* --- PACZKI DO ODEBRANIA --- */}
    <div style={{ marginTop: "20px" }}>
      <h4>📦 Packages Ready for Pickup at this location</h4>
      {courierStatus.pickupReady.length === 0 ? (
        <p style={{ color: "#aaa" }}>No packages waiting here</p>
      ) : (
        <>
          <ul>
            {courierStatus.pickupReady.map((p) => (
              <li key={p.packageId}>
                {p.packageId} — locker {p.id}, destined for group{" "}
                <b>{p.destinationGroupId}</b>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              if (!selectedGroup) return alert("Select locker group first!");
              send("/lockers/pickup", { groupId: Number(selectedGroup) }).then(
                () => refreshCourierStatus(selectedGroup)
              );
            }}
          >
            🚚 Pickup all from here
          </button>
        </>
      )}
    </div>

    {/* --- PACZKI DO DOSTARCZENIA --- */}
    <div style={{ marginTop: "25px" }}>
      <h4>📬 Packages to Deliver to this location</h4>
      {courierStatus.toDeliver.length === 0 ? (
        <p style={{ color: "#aaa" }}>No deliveries for this location</p>
      ) : (
        <>
          <ul>
            {courierStatus.toDeliver.map((p) => (
              <li key={p.packageId}>
                {p.packageId} — destined for user ID {p.assignedTo}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              if (!selectedGroup) return alert("Select locker group first!");
              send("/lockers/deliver", {
                toGroupId: Number(selectedGroup),
              }).then(() => refreshCourierStatus(selectedGroup));
            }}
          >
            📦 Deliver all to this location
          </button>
        </>
      )}
    </div>
  </div>
)}
      {/* ---------------- SERVICE PANEL ---------------- */}
      {user.role === "service" && (
        <>
          <div style={{ marginBottom: "8px", marginTop: "12px" }}>
            <button onClick={() => loadLockers()}>Reload</button>
          </div>
          <button
            onClick={() => {
              const id = prompt("Locker ID to mark as broken:");
              if (id) send("/lockers/broken", { id });
            }}
          >
            Mark Broken
          </button>
          <button
            onClick={() => {
              const id = prompt("Locker ID to repair:");
              if (id) send("/lockers/repaired", { id });
            }}
          >
            Repair
          </button>
          <pre>{JSON.stringify(lockers, null, 2)}</pre>
        </>
      )}

      {/* ---------------- ADMIN PANEL ---------------- */}
      {user.role === "admin" && (
        <>
          <button
            onClick={loadLockers}
            style={{
              marginBottom: "10px",
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            View Lockers
          </button>

          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              maxWidth: "800px",
              color: "#ddd",
              marginTop: "10px",
            }}
          >
            <thead>
              <tr style={{ background: "#333" }}>
                <th>ID</th>
                <th>Group</th>
                <th>Status</th>
                <th>Last Action</th>
                <th>Assigned To</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {lockers.map((l) => (
                <tr key={l.id}>
                  <td style={{ border: "1px solid #555", padding: "6px" }}>
                    {l.id}
                  </td>
                  <td style={{ border: "1px solid #555", padding: "6px" }}>
                    {l.groupId}
                  </td>
                  <td
                    style={{
                      border: "1px solid #555",
                      padding: "6px",
                      color:
                        l.status === "free"
                          ? "limegreen"
                          : l.status === "broken"
                          ? "orange"
                          : "skyblue",
                    }}
                  >
                    {l.status}
                  </td>
                  <td style={{ border: "1px solid #555", padding: "6px" }}>
                    {l.lastAction || "-"}
                  </td>
                  <td style={{ border: "1px solid #555", padding: "6px" }}>
                    {l.assignedTo || "-"}
                  </td>
                  <td style={{ border: "1px solid #555", padding: "6px" }}>
                    {l.updatedAt ? l.updatedAt.replace("T", " ") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}