import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CookieConsent from "react-cookie-consent";
// Lazy‑loaded pages
const FormationIA = lazy(() => import("./pages/FormationIA"));
const FormationPrompt = lazy(() => import("./pages/FormationPrompt"));
const FormationBureautique = lazy(() => import("./pages/FormationBureautique"));
const FormationOF = lazy(() => import("./pages/FormationOF"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Contact = lazy(() => import("./pages/Contact"));
const Legal = lazy(() => import("./pages/Legal"));
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

function App() {
  return (
    <>
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
            <Route path="formation-ia-generative" element={<FormationIA />} />
            <Route path="formation-prompt-engineering" element={<FormationPrompt />} />
            <Route path="formation-bureautique" element={<FormationBureautique />} />
            <Route path="formation-organismes" element={<FormationOF />} />
            <Route path="a-propos" element={<About />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="contact" element={<Contact />} />
            <Route path="mentions-legales" element={<Legal />} />
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
            <Route path="course/:id" element={<CoursePlayer />} />
          </Route>
        </Routes>
      </Suspense>

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
        <a href="/privacy" style={{ color: "var(--color-primary-light)" }}>En savoir plus</a>
      </CookieConsent>
    </>
  );
}

export default App;
