import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components';

export default function Intro() {
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => nav('/login'), 480);
  }

  useEffect(() => {
    const t = setTimeout(enter, 4300); // entrée automatique après l'animation
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`intro ${leaving ? 'intro-leave' : ''}`}>
      <div className="intro-inner">
        <div className="intro-logo"><BrandLogo height={56} /></div>
        <div className="intro-title">e-<span>depot</span></div>
        <div className="intro-tag">TRANSPORT &amp; LOGISTICS · MEDLOG CÔTE D'IVOIRE</div>
        <p className="intro-desc">
          Prise de rendez-vous pour le retour des conteneurs vides MSC vers les OFF-DOCK MEDLOG.
        </p>
        <button className="btn intro-btn" onClick={enter}>Accéder à l'application →</button>
        <div className="intro-bar"><span /></div>
        <div className="intro-skip" onClick={enter}>Passer l'introduction</div>
      </div>
    </div>
  );
}
