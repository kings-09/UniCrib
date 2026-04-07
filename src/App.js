import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from"./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AddProperty from "./pages/AddProperty";
import Dashboard from "./pages/Dashboard";
import SimulatePayment from "./pages/SimulatePayment";


function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Login" element={<Login />} />
          <Route path="/Signup" element={<Signup />} />
          <Route path="/add-property" element={<AddProperty />} />
          <Route path="/simulate-payment/:bookingId" element={<SimulatePayment />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
    </BrowserRouter>
  );
}

export default App;
