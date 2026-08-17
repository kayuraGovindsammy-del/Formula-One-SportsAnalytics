import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Dashboard from "./pages/Dashboard/Dashboard";
import Drivers from "./pages/Drivers/Drivers";

import Races from "./pages/Races/Races";


function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/races" element={<Races />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;