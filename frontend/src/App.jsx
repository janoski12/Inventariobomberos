import { BrowserRouter, Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import BusquedaItems from './pages/BusquedaItems';
import FichaItem from './pages/FichaItem';
import NuevoItem from "./pages/NuevoItem";
import Bomberos from "./pages/Bomberos";
import FichaBombero from "./pages/FichaBombero";
import Ubicaciones from "./pages/Ubicaciones";
import Reportes from "./pages/Reportes";
import Importar from "./pages/Importar";
import Trauma from "./pages/Trauma";

function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <span className="app-header-badge">CBT10</span>
        <span className="app-header-title">Inventario Bomberos</span>
      </header>
      <NavBar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<BusquedaItems />} />
          <Route path="/items/nuevo" element={<NuevoItem />} />
          <Route path="/items/:id" element={<FichaItem />} />
          <Route path="/bomberos" element={<Bomberos />} />
          <Route path="/bomberos/:id" element={<FichaBombero />} />
          <Route path="/ubicaciones" element={<Ubicaciones />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/trauma" element={<Trauma />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
