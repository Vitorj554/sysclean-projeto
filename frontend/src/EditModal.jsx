// frontend/src/EditModal.jsx

import React, { useState } from 'react';

// Este componente representa a janela de edição (modal)
function EditModal({ schedule, collaborators, onClose, onSave }) {
  // Estado para controlar o novo colaborador selecionado no dropdown
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState(schedule.collaboratorId);

  const handleSubmit = () => {
    onSave(schedule.id, selectedCollaboratorId);
  };

  // Formata a data para exibição
  const formattedDate = new Date(schedule.date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Editar Agendamento</h3>
        <p>
          <strong>Data:</strong> {formattedDate}
        </p>
        <p>
          <strong>Responsável Atual:</strong> {schedule.collaborator.name}
        </p>
        <div className="form-group">
          <label htmlFor="collaborator-select">Trocar para:</label>
          <select
            id="collaborator-select"
            value={selectedCollaboratorId}
            onChange={(e) => setSelectedCollaboratorId(e.target.value)}
          >
            {collaborators.map((collab) => (
              <option key={collab.id} value={collab.id}>
                {collab.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
        <button onClick={onClose}>Cancelar</button>
        <button onClick={handleSubmit} className="btn-primary">Salvar Alteração</button>
        </div>
      </div>
    </div>
  );
}

export default EditModal;