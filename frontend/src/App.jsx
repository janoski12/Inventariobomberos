import { BrowserRouter, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import BusquedaItems from './pages/BusquedaItems';
import FichaItem from './pages/FichaItem';
import NuevoItem from "./pages/NuevoItem";
import Bomberos from "./pages/Bomberos";
import Ubicaciones from "./pages/Ubicaciones";

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>Inventario Bomberos</h1>
        <NavBar />

        <Routes>
          <Route path="/" element={<BusquedaItems />} />
          <Route path="/items/:id" element={<FichaItem />} />
          <Route path="/items/nuevo" element={<NuevoItem />} />
          <Route path="/bomberos" element={<Bomberos />} />
          <Route path="/ubicaciones" element={<Ubicaciones />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App;
