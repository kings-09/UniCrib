// import { useEffect, useState } from "react";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import { supabase } from "../supabaseClient";
// import "leaflet/dist/leaflet.css";
// import L from "leaflet";

// function MapView() {
//   const [properties, setProperties] = useState([]);

//   useEffect(() => {
//     fetchProperties();
//   }, []);

//   const fetchProperties = async () => {
//     const { data, error } = await supabase
//       .from("properties")
//       .select("*");

//     if (error) {
//       console.log(error);
//     } else {
//       setProperties(data);
//     }
//   };
//   const customIcon = new L.Icon({
//       iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
//       iconSize: [32, 32],
//     });

//   return (
//     <div style={styles.page}>
//       <div style={styles.header}>
//         <h2 style={styles.title}>Available Properties in Harare</h2>
//         <p style={styles.subtitle}>
//           Browse rental listings near your university
//         </p>
//       </div>

//       <div style={styles.mapCard}>
//         <MapContainer
//           center={[-17.8252, 31.0335]}
//           zoom={14}
//           style={styles.map}
//         >
//           <TileLayer
//             attribution='&copy; OpenStreetMap contributors'
//             url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//           />

//           {properties
//             .filter(
//               (property) =>
//                 property.latitude && property.longitude
//             )
//             .map((property) => (
//               <Marker
//                 key={property.id}
//                 position={[property.latitude, property.longitude]}
//                 icon={customIcon}
//               >
//                 <Popup>
//                   <div style={{ minWidth: "200px" }}>
//                     <h3 style={{ margin: "0 0 5px 0" }}>
//                       {property.title}
//                     </h3>
//                     <p style={{ margin: "5px 0" }}>
//                       {property.description}
//                     </p>
//                     <strong>${property.price}</strong>
//                   </div>
//                 </Popup>
//               </Marker>
//             ))}
//         </MapContainer>
//         <div style={styles.listSection}>
//           <h3 style={{ marginBottom: "20px" }}>Available Listings</h3>

//           <div style={styles.grid}>
//             {properties.map((property) => (
//               <div key={property.id} style={styles.card}>
//                 <h4>{property.title}</h4>
//                 <p>{property.description}</p>
//                 <strong>${property.price}</strong>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );

// }
// const styles = {
//   page: {
//     padding: "40px",
//     backgroundColor: "#f4f6f8",
//     minHeight: "100vh",
//   },
//   header: {
//     marginBottom: "20px",
//   },
//   title: {
//     margin: 0,
//   },
//   subtitle: {
//     color: "#666",
//     marginTop: "5px",
//   },
//   mapCard: {
//     backgroundColor: "white",
//     padding: "20px",
//     borderRadius: "16px",
//     boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
//   },
//   map: {
//     height: "600px",
//     width: "100%",
//     borderRadius: "12px",
//   },
//   listSection: {
//     marginTop: "40px",
//   },
//   grid: {
//     display: "grid",
//     gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
//     gap: "20px",
//   },
//   card: {
//     backgroundColor: "white",
//     padding: "20px",
//     borderRadius: "12px",
//     boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
//   },
// };


// export default MapView;

