// frontend/src/ConfirmDeleteModal.jsx

import React from 'react';

// Este componente representa a janela para confirmar uma exclusão
function ConfirmDeleteModal({ collaboratorName, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Confirmar Exclusão</h3>
        <p>
          Tem certeza que deseja remover o colaborador <strong>{collaboratorName}</strong>?
        </p>
        <p>Esta ação não poderá ser desfeita.</p>
        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={onConfirm} className="delete-btn">
            Sim, Remover
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;