import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard/Dashboard";
import Drivers from "./pages/Drivers/Drivers";
import Races from "./pages/Races/Races";
import DriverDetails from "./pages/DriverDetails/DriverDetails";
import RaceDetails from "./pages/RaceDetails/Racedetails";


function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/drivers/:id" element={<DriverDetails />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/races" element={<Races />} />
          <Route path="/races/:id" element={<RaceDetails />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;