import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import RequireAuth from "./components/RequireAuth";
import { StudioErrorBoundary } from "./studio/components/StudioErrorBoundary";
// Lazy‑loaded pages
const StudioPage = lazy(() => import("./studio/StudioPage"));
const Home = lazy(() => import("./pages/Home"));
const CookieConsent = lazy(() => import("react-cookie-consent"));
const FormationIA = lazy(() => import("./pages/FormationIA"));
const FormationAIAct = lazy(() => import("./pages/FormationAIAct"));
const FormationPrompt = lazy(() => import("./pages/FormationPrompt"));
const FormationBureautique = lazy(() => import("./pages/FormationBureautique"));
const FormationOF = lazy(() => import("./pages/FormationOF"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Contact = lazy(() => import("./pages/Contact"));
const Legal = lazy(() => import("./pages/Legal"));
const Privacy = lazy(() => import("./pages/Privacy"));
const CGV = lazy(() => import("./pages/CGV"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Feedback = lazy(() => import("./pages/Feedback"));
const AvailabilityCalendar = lazy(() => import("./pages/AvailabilityCalendar"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const LearningPath = lazy(() => import("./pages/LearningPath"));
const AttendanceSheets = lazy(() => import("./pages/AttendanceSheets"));
const GuideGPT56 = lazy(() => import("./pages/GuideGPT56"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const CourseBooking = lazy(() => import("./pages/CourseBooking"));
const AttendanceSheet = lazy(() => import("./pages/AttendanceSheet"));
const AttestationDocument = lazy(() => import("./pages/AttestationDocument"));
const IssuedAttestationDocument = lazy(() => import("./pages/IssuedAttestationDocument"));
const AdminEnrollments = lazy(() => import("./pages/AdminEnrollments"));
const AdminAccessIncidents = lazy(() => import("./pages/AdminAccessIncidents"));
const TrainingDocument = lazy(() => import("./pages/TrainingDocument"));

function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100vh",
              color: "var(--color-primary)"
            }}
          >
            Chargement…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Layout/>}>
            <Route index element={<Home />} />
            <Route path="studio" element={<StudioErrorBoundary><StudioPage /></StudioErrorBoundary>} />
            <Route path="formation-ia-generative" element={<FormationIA />} />
            <Route path="formation-ia-act-conformite" element={<FormationAIAct />} />
            <Route path="formation-prompt-engineering" element={<FormationPrompt />} />
            <Route path="formation-bureautique" element={<FormationBureautique />} />
            <Route path="formation-organismes" element={<FormationOF />} />
            <Route path="a-propos" element={<About />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="contact" element={<Contact />} />
            <Route path="mentions-legales" element={<Legal />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="cgv" element={<CGV />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="disponibilites" element={<AvailabilityCalendar />} />
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="register" element={<Register />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/emargements" element={<AttendanceSheets />} />
            <Route path="admin/dossiers" element={<RequireAuth><AdminEnrollments /></RequireAuth>} />
            <Route path="admin/acces-incidents" element={<RequireAuth><AdminAccessIncidents /></RequireAuth>} />
            <Route path="course/:id" element={<CoursePlayer />} />
            <Route
              path="parcours/:slug/:lessonId?"
              element={<RequireAuth><LearningPath /></RequireAuth>}
            />
            <Route path="guide-gpt-5-6-codex" element={<GuideGPT56 />} />
            <Route path="paiement-reussi" element={<PaymentSuccess />} />
            <Route path="reservation-formation" element={<CourseBooking />} />
            <Route path="admin/emargements/:bookingId" element={<AttendanceSheet />} />
            <Route path="admin/attestations/:submissionId/:documentType" element={<AttestationDocument />} />
            <Route path="attestations/:issuanceId" element={<IssuedAttestationDocument />} />
            <Route path="dossiers/:enrollmentId/documents/:documentType" element={<RequireAuth><TrainingDocument /></RequireAuth>} />
          </Route>
        </Routes>
      </Suspense>

      <Suspense fallback={null}>
      <CookieConsent
        location="bottom"
        buttonText="J'accepte"
        declineButtonText="Je refuse"
        enableDeclineButton
        cookieName="formaprompt_cookie_consent"
        style={{ background: "var(--color-secondary)", color: "white" }}
        buttonStyle={{
          background: "var(--color-primary)",
          color: "white",
          fontSize: "14px",
          borderRadius: "4px",
          padding: "8px 16px"
        }}
        declineButtonStyle={{
          background: "transparent",
          border: "1px solid white",
          color: "white",
          fontSize: "14px",
          borderRadius: "4px",
          padding: "8px 16px"
        }}
        expires={150}
      >
        Ce site utilise des cookies pour améliorer votre expérience utilisateur et réaliser des statistiques de visites.{' '}
        <a
          href="/privacy"
          style={{ color: "var(--color-primary-light)", textDecoration: "underline", textUnderlineOffset: "0.2em" }}
        >
          En savoir plus
        </a>
      </CookieConsent>
      </Suspense>
    </>
  );
}

export default App;
