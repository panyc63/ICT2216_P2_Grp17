import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/login.vue'
import Register from '../views/register.vue'
import ForgetPassword from '../views/forgetPassword.vue'
import ResetPassword from '../views/resetPassword.vue'
import AboutUs from '../views/aboutUs.vue'
import Services from '../views/services.vue'
import ContactUs from '../views/contactUs.vue'
import HardwareCheck from '../views/hardwareCheck.vue'
import AdminDashboard from '../views/admin/adminDashboard.vue'
import DocConsult from '../views/doc/docConsult.vue'
import DocPrescribe from '../views/doc/docPrescribe.vue'
import DocDashboard from '../views/doc/docDashboard.vue'
import NurseDashboard from '../views/nurse/nurseDashboard.vue'
import NurseViewQueue from '../views/nurse/nurseViewQueue.vue'
import NurseEditQueue from '../views/nurse/nurseEditQueue.vue'
import PharmacistDashboard from '../views/pharmacist/pharmacistDashboard.vue'
import { dashboardForRole, getCurrentSession } from '../services/api'

// Patient-facing prototype views
import PatientLayout from '../views/patient/PatientLayout.vue'
import Profile from '../views/patient/Profile.vue'
import BookConsultation from '../views/patient/BookConsultation.vue'
import Questionnaire from '../views/patient/Questionnaire.vue'
import MedicationCollection from '../views/patient/MedicationCollection.vue'
import Payment from '../views/patient/Payment.vue'
import Prescription from '../views/patient/Prescription.vue'
import DownloadMC from '../views/patient/DownloadMC.vue'
import TrackDelivery from '../views/patient/TrackDelivery.vue'


const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/forget-password', name: 'ForgetPassword', component: ForgetPassword },
  { path: '/reset-password', name: 'ResetPassword', component: ResetPassword },
  { path: '/about', name: 'AboutUs', component: AboutUs },
  { path: '/services', name: 'Services', component: Services },
  { path: '/contact', name: 'ContactUs', component: ContactUs },
  { path: '/hardware-check', name: 'HardwareCheck', component: HardwareCheck },
  { path: '/admin-dashboard', name: 'AdminDashboard', component: AdminDashboard, meta: { requiresAuth: true, roles: ['Admin'] } },
  { path: '/doc-dashboard', name: 'DocDashboard', component: DocDashboard, meta: { requiresAuth: true, roles: ['Doctor'] } },
  { path: '/doc-consult', name: 'DocConsult', component: DocConsult, meta: { requiresAuth: true, roles: ['Doctor'] } },
  { path: '/doc-prescribe', name: 'DocPrescribe', component: DocPrescribe, meta: { requiresAuth: true, roles: ['Doctor'] } },
  { path: '/nurse-dashboard', name: 'NurseDashboard', component: NurseDashboard, meta: { requiresAuth: true, roles: ['Nurse'] } },
  { path: '/nurse-queue-view', name: 'NurseQueueView', component: NurseViewQueue, meta: { requiresAuth: true, roles: ['Nurse', 'Doctor'] } },
  { path: '/nurse-queue-edit', name: 'NurseQueueEdit', component: NurseEditQueue, meta: { requiresAuth: true, roles: ['Nurse'] } },
  { path: '/pharmacist-dashboard', name: 'PharmacistDashboard', component: PharmacistDashboard, meta: { requiresAuth: true, roles: ['Pharmacist'] } },
  {
    path: '/patient',
    component: PatientLayout,
    meta: { requiresAuth: true, roles: ['Patient'] },
    children: [
      { path: '', redirect: '/patient/profile' },
      { path: 'profile', name: 'PatientProfile', component: Profile },
      { path: 'book-consultation', name: 'BookConsultation', component: BookConsultation },
      { path: 'questionnaire', name: 'Questionnaire', component: Questionnaire },
      { path: 'medication-collection', name: 'MedicationCollection', component: MedicationCollection },
      { path: 'payment', name: 'Payment', component: Payment },
      { path: 'prescription', name: 'Prescription', component: Prescription },
      { path: 'download-mc', name: 'DownloadMC', component: DownloadMC },
      { path: 'track-delivery', name: 'TrackDelivery', component: TrackDelivery }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const session = await getCurrentSession()
  if (!session?.user) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  const allowedRoles = to.meta.roles || []
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
    return dashboardForRole(session.user.role)
  }

  return true
})

export default router
