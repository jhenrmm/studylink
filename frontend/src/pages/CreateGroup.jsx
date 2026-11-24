import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SUBJECT_SUGGESTIONS } from '../academicOptions.js';
import { groupsApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const EMPTY_GROUP = {
  name: '',
  description: '',
  subject: '',
  joinPolicy: 'open',
};

export default function CreateGroup() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_GROUP);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      subject: form.subject.trim(),
      joinPolicy: form.joinPolicy,
    };

    if (!payload.name || !payload.description || !payload.subject) {
      setError('Informe nome, descrição e matéria do grupo.');
      return;
    }

    setSaving(true);

    try {
      await groupsApi.create(payload, token);
      navigate('/groups', { replace: true, state: { created: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page page-narrow">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Grupos de estudo</span>
          <h1>Criar grupo</h1>
          <p>Defina o foco do grupo e reúna estudantes com o mesmo interesse.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="panel edit-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Informações do grupo</h2>
          <p className="muted">
            Você será o <strong>administrador</strong> do grupo e ele ficará
            disponível para outros estudantes.
          </p>

          <div className="field">
            <label htmlFor="group-name">Nome do grupo</label>
            <input
              id="group-name"
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="Ex.: Matemática para o ENEM"
              value={form.name}
              onChange={updateField}
            />
          </div>

          <div className="field">
            <label htmlFor="group-subject">Matéria ou assunto</label>
            <input
              id="group-subject"
              name="subject"
              type="text"
              required
              list="group-subject-suggestions"
              maxLength={100}
              placeholder="Ex.: Matemática"
              value={form.subject}
              onChange={updateField}
            />
            <datalist id="group-subject-suggestions">
              {SUBJECT_SUGGESTIONS.map((subject) => <option value={subject} key={subject} />)}
            </datalist>
            <small className="field-hint">
              Escolha uma sugestão ou escreva o assunto do grupo.
            </small>
          </div>

          <div className="field">
            <label htmlFor="group-join-policy">Forma de entrada</label>
            <select
              id="group-join-policy"
              name="joinPolicy"
              value={form.joinPolicy}
              onChange={updateField}
            >
              <option value="open">Entrada livre — qualquer estudante entra direto</option>
              <option value="approval">Com aprovação — estudantes solicitam participação</option>
            </select>
            <small className="field-hint">
              Defina como os estudantes poderão entrar no seu grupo.
            </small>
          </div>

          <div className="field">
            <label htmlFor="group-description">Descrição</label>
            <textarea
              id="group-description"
              name="description"
              required
              rows={5}
              maxLength={1000}
              placeholder="Explique o objetivo do grupo, como serão os estudos e quem pode participar."
              value={form.description}
              onChange={updateField}
            />
            <small className="field-hint">{form.description.length}/1000 caracteres</small>
          </div>
        </div>

        <div className="form-actions">
          <Link className="button button-outline" to="/groups">Cancelar</Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Criando...' : 'Criar grupo'}
          </button>
        </div>
      </form>
    </div>
  );
}
