import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  INTEREST_SUGGESTIONS,
  LEVELS,
  SUBJECT_SUGGESTIONS,
} from '../academicOptions.js';
import { profileApi } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import TagInput from '../components/TagInput.jsx';

const EMPTY_PROFILE = {
  name: '',
  bio: '',
  academic_level: '',
  subjects: [],
  interests: [],
};

function isMissingProfile(error) {
  return /not found|não encontrado/i.test(error.message);
}

export default function EditProfile() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    profileApi
      .get(token)
      .then((data) => {
        if (!active) return;
        setForm({
          name: data.name || '',
          bio: data.bio || '',
          academic_level: data.academic_level || '',
          subjects: data.subjects || [],
          interests: data.interests || [],
        });
      })
      .catch((err) => {
        if (active && !isMissingProfile(err)) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      name: form.name.trim() || null,
      bio: form.bio.trim() || null,
      academic_level: form.academic_level.trim() || null,
      subjects: form.subjects,
      interests: form.interests,
    };

    try {
      await profileApi.save(payload, token);
      navigate('/profile', { replace: true, state: { saved: true } });
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
          <span className="eyebrow">Perfil acadêmico</span>
          <h1>Editar perfil</h1>
          <p>Conte sobre seus estudos e o que você gostaria de aprender.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading ? (
        <div className="state-card">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando suas informações...</p>
        </div>
      ) : (
        <form className="panel edit-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Informações básicas</h2>
            <p className="muted">
              Conta vinculada: <strong>{user?.email}</strong>
            </p>

            <div className="field">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                name="name"
                type="text"
                maxLength={120}
                placeholder="Como você quer ser chamado?"
                value={form.name}
                onChange={updateField}
              />
            </div>

            <div className="field">
              <label htmlFor="academic_level">Nível acadêmico</label>
              <input
                id="academic_level"
                name="academic_level"
                type="text"
                list="academic-levels"
                maxLength={100}
                placeholder="Ex.: Graduação"
                value={form.academic_level}
                onChange={updateField}
              />
              <datalist id="academic-levels">
                {LEVELS.map((level) => <option value={level} key={level} />)}
              </datalist>
            </div>

            <div className="field">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                rows={5}
                maxLength={1000}
                placeholder="Escreva um pouco sobre sua trajetória e seus objetivos."
                value={form.bio}
                onChange={updateField}
              />
              <small className="field-hint">{form.bio.length}/1000 caracteres</small>
            </div>
          </div>

          <div className="form-section">
            <h2>Áreas de estudo</h2>

            <TagInput
              id="subjects"
              label="Matérias"
              value={form.subjects}
              onChange={(subjects) => setForm((current) => ({ ...current, subjects }))}
              placeholder="Ex.: Matemática e pressione Enter"
              suggestions={SUBJECT_SUGGESTIONS}
              hint="Pressione Enter ou vírgula para adicionar. Até 50 itens."
            />

            <TagInput
              id="interests"
              label="Interesses"
              value={form.interests}
              onChange={(interests) => setForm((current) => ({ ...current, interests }))}
              placeholder="Ex.: Estudos em grupo e pressione Enter"
              suggestions={INTEREST_SUGGESTIONS}
              hint="Pressione Enter ou vírgula para adicionar. Até 50 itens."
            />
          </div>

          <div className="form-actions">
            <Link className="button button-outline" to="/profile">Cancelar</Link>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
