import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock3, TriangleAlert } from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabaseClient';
import { BOOKING_COURSES, DEFAULT_BOOKING_COURSE_ID, getBookingCourse } from '../data/bookingCatalog';

export default function PaymentSuccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedCourseId = searchParams.get('course') || DEFAULT_BOOKING_COURSE_ID;
  const courseId = BOOKING_COURSES[requestedCourseId] ? requestedCourseId : DEFAULT_BOOKING_COURSE_ID;
  const course = getBookingCourse(courseId);
  const [activationStatus, setActivationStatus] = useState('checking');
  const status = user ? activationStatus : 'login-required';

  useEffect(() => {
    if (!user) return undefined;

    let stopped = false;
    let timer;
    let attempts = 0;

    async function checkAccess() {
      attempts += 1;
      const { data, error } = await supabase
        .from('course_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();

      if (stopped) return;

      if (error) {
        console.error("Vérification de l'activation impossible :", error);
        setActivationStatus('error');
        return;
      }

      if (data) {
        setActivationStatus('active');
        return;
      }

      if (attempts >= 10) {
        setActivationStatus('pending');
        return;
      }

      timer = window.setTimeout(checkAccess, 1500);
    }

    checkAccess();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [user, courseId]);

  const messages = {
    checking: {
      icon: <Clock3 size={42} aria-hidden="true" />,
      title: 'Paiement reçu, activation en cours',
      text: 'Stripe confirme la transaction à FormaPrompt. Cette vérification prend généralement quelques secondes.',
    },
    active: {
      icon: <CheckCircle size={42} aria-hidden="true" />,
      title: 'Votre formation est disponible',
      text: `L'achat a bien été enregistré et votre accès à « ${course.shortTitle} » est maintenant actif.`,
    },
    pending: {
      icon: <Clock3 size={42} aria-hidden="true" />,
      title: 'Activation encore en cours',
      text: "La confirmation prend plus de temps que prévu. Aucun nouveau paiement n'est nécessaire : consultez votre espace apprenant dans quelques instants.",
    },
    error: {
      icon: <TriangleAlert size={42} aria-hidden="true" />,
      title: "Vérification temporairement indisponible",
      text: "Votre paiement test n'est pas perdu. Consultez votre espace apprenant ou contactez FormaPrompt si l'accès n'apparaît pas.",
    },
    'login-required': {
      icon: <TriangleAlert size={42} aria-hidden="true" />,
      title: 'Connexion requise',
      text: "Connectez-vous avec le compte utilisé avant le paiement pour vérifier l'activation de la formation.",
    },
  };

  const message = messages[status];

  return (
    <>
      <SEO
        title="Confirmation du paiement – FormaPrompt"
        description="Confirmation et activation de votre formation FormaPrompt."
        url="https://formaprompt.com/paiement-reussi"
      />
      <main className="container section" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <section
          aria-live="polite"
          style={{ maxWidth: '680px', padding: '2rem', textAlign: 'center', border: '1px solid #d8e2dc', borderRadius: '16px' }}
        >
          <div style={{ color: status === 'active' ? '#0f766e' : '#64748b' }}>{message.icon}</div>
          <h1 style={{ marginTop: '1rem' }}>{message.title}</h1>
          <p style={{ margin: '1rem 0 1.5rem' }}>{message.text}</p>

          {status === 'active' && (
            <Link to={course.coursePath} className="btn btn-primary">
              Commencer la formation
            </Link>
          )}
          {status === 'login-required' && (
            <Link to="/login" className="btn btn-primary">Se connecter</Link>
          )}
          {['checking', 'pending', 'error'].includes(status) && (
            <Link to="/dashboard" className="btn btn-primary">Consulter mon espace apprenant</Link>
          )}
        </section>
      </main>
    </>
  );
}
