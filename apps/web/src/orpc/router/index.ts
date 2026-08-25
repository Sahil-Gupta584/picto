import { addTodo, listTodos } from './todos'
import {
  getPlans,
  getSubscription,
  createCheckout,
  cancelSubscription,
  resumeSubscription,
} from './payments'
import {
  listUserForms,
  createForm,
  getForm,
  updateFormFields,
  deleteForm,
  submitFormResponse,
  getFormSubmissions,
} from './forms'
import { maintainerRouter } from '../maintainer-router'

export default {
  listTodos,
  addTodo,
  billing: {
    getPlans,
    getSubscription,
    createCheckout,
    cancelSubscription,
    resumeSubscription,
  },
  forms: {
    listUserForms,
    createForm,
    getForm,
    updateFormFields,
    deleteForm,
    submitFormResponse,
    getFormSubmissions,
  },
  maintainer: maintainerRouter,
}
