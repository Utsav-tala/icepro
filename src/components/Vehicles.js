// src/components/Vehicles.js
import { Tag } from "./UI";

const C = { red: "#c8181e", yellow: "#f5c518", text: "#1a0505", textLight: "#a07070", textMid: "#6b3333" };

const DUMMY_VEHICLES = [
  { id: "V01", name: "GJ-03-AB-1234", status: "on-route", route: "Rajkot → Jamnagar"  },
  { id: "V02", name: "GJ-03-CD-5678", status: "idle",     route: null                  },
  { id: "V03", name: "GJ-03-EF-9012", status: "on-route", route: "Factory → Junagadh" },
  { id: "V04", name: "GJ-03-GH-3456", status: "idle",     route: null                  },
];

export function VehiclesPage() {
  return (
    <div className="fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#9e1015", fontFamily: "'Playfair Display',serif" }}>Vehicles 🚚</h1>
          <p style={{ color: C.textLight, fontSize: 13, marginTop: 3 }}>Fleet management</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {DUMMY_VEHICLES.map(v => (
          <div key={v.id} className="card" style={{ borderLeft: `4px solid ${v.status === "on-route" ? C.red : C.yellow}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{v.name}</div>
              <Tag cls={v.status === "on-route" ? "ba" : "bp"}>{v.status}</Tag>
            </div>
            <div style={{ fontSize: 11, color: v.route ? C.red : C.textLight, marginTop: 4 }}>
              {v.route || "Idle at factory"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: "12px 16px", background: "#fffbeb", borderRadius: 10, border: `1px solid ${C.yellow}`, fontSize: 12, color: "#92400e" }}>
        🚧 Full vehicle management (add/edit/delete vehicles, live tracking) coming in the next update.
      </div>
    </div>
  );
}
