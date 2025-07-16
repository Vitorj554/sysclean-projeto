import React, { useState } from 'react';

function CollaboratorManager({ collaborators, onAdd, onDelete }) {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState(''); // <-- NOVO ESTADO PARA A SENHA

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Agora envia a senha junto
    onAdd(newName, newEmail, newPassword);

    setNewName('');
    setNewEmail('');
    setNewPassword(''); // Limpa o campo de senha
  };

  return (
    <div className="form-section card">
      <h2>Adicionar / Remover Colaboradores</h2>
      <form onSubmit={handleFormSubmit}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome"
          required
        />
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Endereço de e-mail"
          required
        />
        {/* NOVO CAMPO DE SENHA */}
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Senha Inicial"
          required
        />
        <button type="submit" className="btn-primary">Adicionar</button>
      </form>
      <ul>
        {collaborators.map((collab) => (
          <li key={collab.id}>
            {collab.name}
            <button onClick={() => onDelete(collab)} className="delete-btn">
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CollaboratorManager;