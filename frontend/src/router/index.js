import { createRouter, createWebHistory } from 'vue-router'
import { portalFor } from '../composables/useAuth'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgetPassword from '../views/ForgetPassword.vue'
import HardwareCheck from '../views/HardwareCheck.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import DocConsult from '../views/doc/docConsult.vue'
import DocConsultRoom from '../views/doc/ConsultationRoom.vue'
import DocFinalize from '../views/doc/DocFinalize.vue'

// Patient-facing prototype views
import PatientLayout from '../views/patient/PatientLayout.vue'
import Profile from '../views/patient/Profile.vue'
import Questionnaire from '../views/patient/Questionnaire.vue'
import Queue from '../views/patient/Queue.vue'
import VideoConsultation from '../views/patient/VideoConsultation.vue'
import ConsultPayment from '../views/patient/ConsultPayment.vue'
import MedicationPayment from '../views/patient/MedicationPayment.vue'
import Prescription from '../views/patient/Prescription.vue'
import DownloadMC from '../views/patient/DownloadMC.vue'
import TrackDelivery from '../views/patient/TrackDelivery.vue'
import Closing from '../views/patient/Closing.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/forget-password', name: 'ForgetPassword', component: ForgetPassword },
  { path: '/admin-dashboard', name: 'AdminDashboard', component: AdminDashboard, meta: { requiresAuth: true } },
  { path: '/doc-consult', name: 'DocConsult', component: DocConsult, meta: { requiresAuth: true } },
  { path: '/doc-consult-room', name: 'DocConsultRoom', component: DocConsultRoom, meta: { requiresAuth: true } },
  { path: '/doc-finalize', name: 'DocFinalize', component: DocFinalize, meta: { requiresAuth: true } },
  {
    path: '/patient',
    component: PatientLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/patient/profile' },
      { path: 'profile', name: 'PatientProfile', component: Profile },
      { path: 'questionnaire', name: 'Questionnaire', component: Questionnaire },
      { path: 'hardware-check', name: 'HardwareCheck', component: HardwareCheck, props: { redirectTo: '/patient/consult-payment' } },
      { path: 'consult-payment', name: 'ConsultPayment', component: ConsultPayment },
      { path: 'queue', name: 'Queue', component: Queue },
      { path: 'video-consultation', name: 'VideoConsultation', component: VideoConsultation },
      { path: 'prescription', name: 'Prescription', component: Prescription },
      { path: 'medication-payment', name: 'MedicationPayment', component: MedicationPayment },
      { path: 'closing', name: 'Closing', component: Closing },
      { path: 'download-mc', name: 'DownloadMC', component: DownloadMC },
      { path: 'track-delivery', name: 'TrackDelivery', component: TrackDelivery }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const loggedIn = !!localStorage.getItem('userId')

  // A logged-in user has no business on the login page — send them to their
  // portal. Role → path is centralized in useAuth's portal map.
  if (to.path === '/login' && loggedIn) {
    return portalFor(localStorage.getItem('userRole'))
  }

  // Protected routes require a session. After logout this is what actually
  // bounces the user out — without it, /admin-dashboard etc. stay reachable.
  if (to.matched.some((r) => r.meta.requiresAuth) && !loggedIn) {
    return '/login'
  }
})

export default router
