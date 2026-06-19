import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgetPassword from '../views/ForgetPassword.vue'
import HardwareCheck from '../views/HardwareCheck.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import DocConsult from '../views/doc/docConsult.vue'
import DocPrescribe from '../views/doc/docPrescribe.vue'
import DocDashboard from '../views/doc/docDashboard.vue'
import NurseDashboard from '../views/nurse/nurseDashboard.vue'
import NurseViewQueue from '../views/nurse/nurseViewQueue.vue'
import NurseEditQueue from '../views/nurse/nurseEditQueue.vue'

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
  { path: '/hardware-check', name: 'HardwareCheck', component: HardwareCheck },
  { path: '/admin-dashboard', name: 'AdminDashboard', component: AdminDashboard },
  { path: '/doc-dashboard', name: 'DocDashboard', component: DocDashboard },
  { path: '/doc-consult', name: 'DocConsult', component: DocConsult },
  { path: '/doc-prescribe', name: 'DocPrescribe', component: DocPrescribe },
  { path: '/nurse-dashboard', name: 'NurseDashboard', component: NurseDashboard },
  { path: '/nurse-queue-view', name: 'NurseQueueView', component: NurseViewQueue },
  { path: '/nurse-queue-edit', name: 'NurseQueueEdit', component: NurseEditQueue },
  {
    path: '/patient',
    component: PatientLayout,
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

export default router
