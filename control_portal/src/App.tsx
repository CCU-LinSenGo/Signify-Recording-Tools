import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ActionsHub from './pages/ActionsHub';
import ActionGallery from './pages/ActionGallery';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="actions" element={<ActionsHub />} />
        <Route path="actions/:actionName" element={<ActionGallery />} />
      </Route>
    </Routes>
  );
}

export default App;
