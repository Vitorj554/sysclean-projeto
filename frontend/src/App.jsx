import { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import LoginPage from './LoginPage';
import EditModal from './EditModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import CollaboratorManager from './CollaboratorManager';
import LoadingSpinner from './LoadingSpinner';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [schedule, setSchedule] = useState({ past: [], future: [] });
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingCollaborator, setDeletingCollaborator] = useState(null);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
  };

  const fetchData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [collabResponse, scheduleResponse] = await Promise.all([
        axios.get('http://localhost:3001/api/collaborators'),
        axios.get('http://localhost:3001/api/schedule'),
      ]);
      setCollaborators(collabResponse.data);
      setSchedule({
        past: scheduleResponse.data.pastSchedules,
        future: scheduleResponse.data.futureSchedules,
      });
    } catch (err) {
      toast.error('Falha ao buscar dados do servidor.');
      console.error('Falha ao buscar dados.', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

 const handleAddCollaborator = async (name, email, password) => { 
  if (!name.trim() || !email.trim() || !password.trim()) {
    toast.error('Por favor, preencha nome, e-mail e senha inicial.');
    return;
  }
  try {
    await axios.post('http://localhost:3001/api/auth/register', { name, email, password });
    toast.success('Colaborador adicionado com sucesso!');
    fetchData(); 
  } catch (err) {
    toast.error('Falha ao criar colaborador. Verifique se o e-mail já existe.');
  }
};
  const handleDeleteCollaborator = (collaborator) => {
    setDeletingCollaborator(collaborator);
  };

  const confirmDeleteCollaborator = async () => {
    if (!deletingCollaborator) return;
    try {
      await axios.delete(`http://localhost:3001/api/collaborators/${deletingCollaborator.id}`);
      toast.success(`Colaborador '${deletingCollaborator.name}' removido com sucesso!`);
      setDeletingCollaborator(null);
      fetchData();
    } catch (err) {
      toast.error('Falha ao remover o colaborador.');
      setDeletingCollaborator(null);
    }
  };

  const handleSaveEdit = async (scheduleId, newCollaboratorId) => {
    try {
      await axios.put(`http://localhost:3001/api/schedule/${scheduleId}`, { newCollaboratorId });
      toast.success('Agendamento atualizado com sucesso!');
      setEditingSchedule(null);
      fetchData();
    } catch (error) {
      toast.error('Falha ao editar o agendamento.');
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  if (!currentUser) {
    return (
      <div>
        <Toaster position="top-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <Toaster position="top-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      {editingSchedule && (
        <EditModal
          schedule={editingSchedule}
          collaborators={collaborators}
          onClose={() => setEditingSchedule(null)}
          onSave={handleSaveEdit}
        />
      )}
      {deletingCollaborator && (
        <ConfirmDeleteModal
          collaboratorName={deletingCollaborator.name}
          onClose={() => setDeletingCollaborator(null)}
          onConfirm={confirmDeleteCollaborator}
        />
      )}
      <header className="app-header">
        <h1>Escala de Limpeza</h1>
        <div className="controls-container">
          <span className="user-info">Logado como: {currentUser.name} ({currentUser.role})</span>
          {currentUser.role === 'ADMIN' && (
            <button onClick={() => setShowManager(!showManager)} className="btn-secondary">
              {showManager ? 'Ocultar Gestão' : 'Gerenciar Colaboradores'}
            </button>
          )}
        </div>
      </header>
      
      <main className="container">
        {showManager && currentUser.role === 'ADMIN' && (
          <CollaboratorManager
            collaborators={collaborators}
            onAdd={handleAddCollaborator}
            onDelete={handleDeleteCollaborator}
          />
        )}
        
        <div className="schedule-section card">
          <h2>Escala de Limpeza</h2>
          <h3>Próximos Agendamentos</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Responsável</th>
                {currentUser.role === 'ADMIN' && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {schedule.future.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.collaborator.name}</td>
                  {currentUser.role === 'ADMIN' && (
                    <td>
                      {!item.isGenerated && (
                        <button onClick={() => setEditingSchedule(item)} className="edit-btn">
                          Editar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Histórico de Limpeza</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {schedule.past.length > 0 ? (
                schedule.past.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.collaborator.name}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2">Nenhum histórico encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;