import axios from 'axios'

// Mock API client for tests
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Mock interceptors
apiClient.interceptors.request.use = jest.fn()
apiClient.interceptors.response.use = jest.fn()

export default apiClient