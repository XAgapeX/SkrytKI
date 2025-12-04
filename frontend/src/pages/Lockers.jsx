import { useState, useEffect, useContext } from "react";
import API from "../api";
import { AuthContext } from "../AuthContext";

export default function Lockers() {
  const { user } = useContext(AuthContext);
  const [lockers, setLockers] = useState([]);

  async function loadLockers() {
    try {
      const { data } = await API.get("/lockers");
      setLockers(data.lockers || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function send(path, body = {}) {
    await API.post(path, body);
    loadLockers();
  }

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "service") loadLockers();
  }, [user]);

  if (!user) return <p>Login first!</p>;

  return (
    <div>
      <h2>Locker Panel ({user.role})</h2>

      {user.role === "user" && (
        <>
          <button onClick={() => send("/lockers/send")}>Send Package</button>
          <button onClick={() => send("/lockers/receive")}>Receive Package</button>
        </>
      )}

      {user.role === "courier" && (
        <>
          <button onClick={() => send("/lockers/pickup")}>Pickup</button>
          <button
            onClick={() => {
              const email = prompt("Recipient email:");
              if (email) send("/lockers/deliver", { recipientEmail: email });
            }}
          >
            Deliver
          </button>
        </>
      )}

      {user.role === "service" && (
        <>
          <button onClick={() => loadLockers()}>Reload</button>
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

      {user.role === "admin" && (
  <>
    <button
      onClick={loadLockers}
      style={{ marginBottom: "10px", padding: "8px 14px", cursor: "pointer" }}
    >
      View Lockers
    </button>

    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        maxWidth: "700px",
        color: "#ddd",
        marginTop: "10px",
      }}
    >
      <thead>
        <tr style={{ background: "#333" }}>
          <th style={{ border: "1px solid #555", padding: "6px" }}>ID</th>
          <th style={{ border: "1px solid #555", padding: "6px" }}>Status</th>
          <th style={{ border: "1px solid #555", padding: "6px" }}>Last Action</th>
          <th style={{ border: "1px solid #555", padding: "6px" }}>Assigned To</th>
          <th style={{ border: "1px solid #555", padding: "6px" }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {lockers.map((l) => (
          <tr key={l.id}>
            <td style={{ border: "1px solid #555", padding: "6px" }}>{l.id}</td>
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
            <td style={{ border: "1px solid #555", padding: "6px" }}>{l.lastAction || "-"}</td>
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