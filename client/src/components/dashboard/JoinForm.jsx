import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon, KeyboardIcon } from 'lucide-react'
import api from '../../config/api'
import { MEETING_CODE_RE, apiError, normalizeCode } from '../../lib/meetings'

// Join by code or pasted invite link. The code formats itself as you type (abc-def-ghi).
const JoinForm = ({ className = '' }) => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const valid = MEETING_CODE_RE.test(code);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) {
      setError('Codes look like abc-def-ghi.');
      return;
    }
    setChecking(true);
    setError('');
    try {
      await api.get(`/api/meetings/${code}`);
      navigate(`/meeting/${code}`);
    } catch (err) {
      setError(apiError(err, "We couldn't find that meeting."));
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex gap-2">
        <label className="input-wrap flex-1">
          <KeyboardIcon size={18} />
          <span className="sr-only">Meeting code or link</span>
          <input
            className="input h-12 font-mono text-[15px] tracking-wide placeholder:font-sans placeholder:tracking-normal"
            placeholder="Enter a code or link"
            value={code}
            onChange={(e) => { setCode(normalizeCode(e.target.value)); setError(''); }}
            onPaste={(e) => { e.preventDefault(); setCode(normalizeCode(e.clipboardData.getData('text'))); setError(''); }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'join-error' : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn btn-ghost h-12 px-5" disabled={!code || checking}>
          {checking ? <span className="spinner size-4" /> : <>Join <ArrowRightIcon size={16} /></>}
        </button>
      </div>
      {error && <p id="join-error" className="mt-2 text-[13px] text-danger" role="alert">{error}</p>}
    </form>
  );
};

export default JoinForm
