import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgetPassword from '../views/ForgetPassword.vue'
import HardwareCheck from '../views/HardwareCheck.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import DocConsult from '../views/doc/docConsult.vue'
import DocConsultRoom from '../views/doc/ConsultationRoom.vue'

// Patient-facing prototype views
import PatientLayout from '../views/patient/PatientLayout.vue'
import Profile from '../views/patient/Profile.vue'
import Questionnaire from '../views/patient/Questionnaire.vue'
import Queue from '../views/patient/Queue.vue'
import VideoConsultation from '../views/patient/VideoConsultation.vue'
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
  { path: '/doc-consult', name: 'DocConsult', component: DocConsult },
  { path: '/doc-consult-room', name: 'DocConsultRoom', component: DocConsultRoom },
  {
    path: '/patient',
    component: PatientLayout,
    children: [
      { path: '', redirect: '/patient/profile' },
      { path: 'profile', name: 'PatientProfile', component: Profile },
      { path: 'questionnaire', name: 'Questionnaire', component: Questionnaire },
      { path: 'queue', name: 'Queue', component: Queue },
      { path: 'video-consultation', name: 'VideoConsultation', component: VideoConsultation },
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
