import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard/Dashboard";
import Drivers from "./pages/Drivers/Drivers";
import Races from "./pages/Races/Races";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/races" element={<Races />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;