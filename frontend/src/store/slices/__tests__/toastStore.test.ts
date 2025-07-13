import { act, renderHook } from '@testing-library/react'
import { useToastStore } from '../toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useToastStore.setState({
      toasts: [],
      position: 'bottom-right',
      maxVisible: 5,
      defaultDuration: 5000,
    })
  })

  describe('addToast', () => {
    it('should add a toast with generated id', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        const id = result.current.addToast({
          title: 'Test Toast',
          description: 'Test description',
          variant: 'success',
        })
        
        expect(typeof id).toBe('string')
        expect(result.current.toasts).toHaveLength(1)
        expect(result.current.toasts[0]).toMatchObject({
          title: 'Test Toast',
          description: 'Test description',
          variant: 'success',
          duration: 5000,
        })
      })
    })

    it('should use default duration when not specified', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.addToast({
          title: 'Test Toast',
        })
        
        expect(result.current.toasts[0].duration).toBe(5000)
      })
    })

    it('should respect custom duration', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.addToast({
          title: 'Test Toast',
          duration: 3000,
        })
        
        expect(result.current.toasts[0].duration).toBe(3000)
      })
    })

    it('should auto-remove non-persistent toasts after duration', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.addToast({
          title: 'Test Toast',
          duration: 1000,
        })
      })
      
      expect(result.current.toasts).toHaveLength(1)
      
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      
      expect(result.current.toasts).toHaveLength(0)
      
      vi.useRealTimers()
    })

    it('should not auto-remove persistent toasts', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.addToast({
          title: 'Test Toast',
          duration: 1000,
          persistent: true,
        })
      })
      
      expect(result.current.toasts).toHaveLength(1)
      
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      
      expect(result.current.toasts).toHaveLength(1)
      
      vi.useRealTimers()
    })
  })

  describe('updateToast', () => {
    it('should update existing toast', () => {
      const { result } = renderHook(() => useToastStore())
      let toastId: string
      
      act(() => {
        toastId = result.current.addToast({
          title: 'Original Title',
          variant: 'default',
        })
      })
      
      act(() => {
        result.current.updateToast(toastId, {
          title: 'Updated Title',
          variant: 'success',
        })
      })
      
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Updated Title',
        variant: 'success',
      })
    })

    it('should not crash when updating non-existent toast', () => {
      const { result } = renderHook(() => useToastStore())
      
      expect(() => {
        act(() => {
          result.current.updateToast('non-existent-id', {
            title: 'Updated',
          })
        })
      }).not.toThrow()
    })
  })

  describe('removeToast', () => {
    it('should remove specific toast', () => {
      const { result } = renderHook(() => useToastStore())
      let toastId1: string
      let toastId2: string
      
      act(() => {
        toastId1 = result.current.addToast({ title: 'Toast 1' })
        toastId2 = result.current.addToast({ title: 'Toast 2' })
      })
      
      expect(result.current.toasts).toHaveLength(2)
      
      act(() => {
        result.current.removeToast(toastId1)
      })
      
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Toast 2')
    })

    it('should call onClose callback when removing', () => {
      const { result } = renderHook(() => useToastStore())
      const onClose = vi.fn()
      let toastId: string
      
      act(() => {
        toastId = result.current.addToast({
          title: 'Test Toast',
          onClose,
        })
      })
      
      act(() => {
        result.current.removeToast(toastId)
      })
      
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('removeAllToasts', () => {
    it('should remove all toasts', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.addToast({ title: 'Toast 1' })
        result.current.addToast({ title: 'Toast 2' })
        result.current.addToast({ title: 'Toast 3' })
      })
      
      expect(result.current.toasts).toHaveLength(3)
      
      act(() => {
        result.current.removeAllToasts()
      })
      
      expect(result.current.toasts).toHaveLength(0)
    })

    it('should call all onClose callbacks', () => {
      const { result } = renderHook(() => useToastStore())
      const onClose1 = vi.fn()
      const onClose2 = vi.fn()
      
      act(() => {
        result.current.addToast({ title: 'Toast 1', onClose: onClose1 })
        result.current.addToast({ title: 'Toast 2', onClose: onClose2 })
      })
      
      act(() => {
        result.current.removeAllToasts()
      })
      
      expect(onClose1).toHaveBeenCalled()
      expect(onClose2).toHaveBeenCalled()
    })
  })

  describe('toast utility methods', () => {
    it('should create success toast', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.toast.success('Success', 'Operation completed')
      })
      
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Success',
        description: 'Operation completed',
        variant: 'success',
      })
    })

    it('should create error toast', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.toast.error('Error', 'Operation failed')
      })
      
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Error',
        description: 'Operation failed',
        variant: 'error',
      })
    })

    it('should create warning toast', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.toast.warning('Warning', 'Be careful')
      })
      
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Warning',
        description: 'Be careful',
        variant: 'warning',
      })
    })

    it('should create info toast', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.toast.info('Info', 'Good to know')
      })
      
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Info',
        description: 'Good to know',
        variant: 'info',
      })
    })
  })

  describe('toast.promise', () => {
    it('should handle successful promise', async () => {
      const { result } = renderHook(() => useToastStore())
      const successData = 'Success data'
      const promise = Promise.resolve(successData)
      
      let promiseResult: string
      
      await act(async () => {
        promiseResult = await result.current.toast.promise(
          promise,
          {
            loading: 'Loading...',
            success: 'Success!',
            error: 'Error!',
          }
        )
      })
      
      expect(promiseResult!).toBe(successData)
      
      // Should show success toast after promise resolves
      const toasts = result.current.toasts
      expect(toasts[toasts.length - 1]).toMatchObject({
        title: 'Success!',
        variant: 'success',
      })
    })

    it('should handle failed promise', async () => {
      const { result } = renderHook(() => useToastStore())
      const error = new Error('Test error')
      const promise = Promise.reject(error)
      
      await act(async () => {
        try {
          await result.current.toast.promise(
            promise,
            {
              loading: 'Loading...',
              success: 'Success!',
              error: 'Error occurred',
            }
          )
        } catch (e) {
          expect(e).toBe(error)
        }
      })
      
      // Should show error toast after promise rejects
      const toasts = result.current.toasts
      expect(toasts[toasts.length - 1]).toMatchObject({
        title: 'Error occurred',
        variant: 'error',
      })
    })

    it('should use function for dynamic messages', async () => {
      const { result } = renderHook(() => useToastStore())
      const userData = { name: 'John' }
      const promise = Promise.resolve(userData)
      
      await act(async () => {
        await result.current.toast.promise(
          promise,
          {
            loading: 'Loading user...',
            success: (user) => `Welcome ${user.name}!`,
            error: (err) => `Error: ${err.message}`,
          }
        )
      })
      
      const toasts = result.current.toasts
      expect(toasts[toasts.length - 1]).toMatchObject({
        title: 'Welcome John!',
        variant: 'success',
      })
    })
  })

  describe('settings', () => {
    it('should update position', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.setPosition('top-center')
      })
      
      expect(result.current.position).toBe('top-center')
    })

    it('should update maxVisible', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.setMaxVisible(3)
      })
      
      expect(result.current.maxVisible).toBe(3)
    })

    it('should update defaultDuration', () => {
      const { result } = renderHook(() => useToastStore())
      
      act(() => {
        result.current.setDefaultDuration(3000)
      })
      
      expect(result.current.defaultDuration).toBe(3000)
    })
  })
})